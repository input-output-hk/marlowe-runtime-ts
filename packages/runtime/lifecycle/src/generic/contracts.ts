import * as TE from "fp-ts/lib/TaskEither.js";
import { pipe } from "fp-ts/lib/function.js";
import { Option } from "fp-ts/lib/Option.js";
import {
  Contract,
  Environment,
  Input,
  Party,
  RoleName,
} from "@marlowe.io/language-core-v1";
import { tryCatchDefault, unsafeTaskEither } from "@marlowe.io/adapter/fp-ts";

import {
  getAddressesAndCollaterals,
  WalletAPI,
  WalletDI,
} from "@marlowe.io/wallet/api";
import {
  PolicyId,
  ContractId,
  contractIdToTxId,
  TxId,
  AddressesAndCollaterals,
  HexTransactionWitnessSet,
  transactionWitnessSetTextEnvelope,
  BlockHeader,
  StakeAddressBech32,
  Metadata,
  Tags,
} from "@marlowe.io/runtime-core";

import {
  FPTSRestAPI,
  RestClient,
  RestDI,
  ItemRange,
  DeprecatedRestDI,
} from "@marlowe.io/runtime-rest-client";
import { DecodingError } from "@marlowe.io/adapter/codec";

import { Next, noNext } from "@marlowe.io/language-core-v1/next";
import {
  BuildCreateContractTxRequest,
  BuildCreateContractTxRequestOptions,
  RolesConfiguration,
  TransactionTextEnvelope,
} from "@marlowe.io/runtime-rest-client/contract";
import { SingleInputTx } from "@marlowe.io/language-core-v1/transaction.js";
import { ISO8601, iso8601ToPosixTime } from "@marlowe.io/adapter/time";
import { ContractBundleList } from "@marlowe.io/marlowe-object";

/**
 *
 * @description Dependency Injection for the Contract API
 * @hidden
 */
export type ContractsDI = WalletDI & RestDI;

/**
 * Request parameters used by {@link api.ContractsAPI#createContract | createContract}.
 * If the contract is "small", you can create it directly with a {@link CreateContractRequestFromContract| core contract},
 * if the contract is "large" you can use a {@link CreateContractRequestFromBundle | contract bundle} instead.
 * Both options share the same {@link CreateContractRequestBase | request parameters}.
 * @category ContractsAPI
 */
export type CreateContractRequest =
  | CreateContractRequestFromContract
  | CreateContractRequestFromBundle;

/**
 * @category ContractsAPI
 */
export interface CreateContractRequestFromContract
  extends CreateContractRequestBase {
  /**
   * The Marlowe Contract to create
   */
  contract: Contract;
}

/**
 * @category ContractsAPI
 */
export interface CreateContractRequestFromBundle
  extends CreateContractRequestBase {
  /**
   * The Marlowe Object bundle to create
   */
  bundle: ContractBundleList<undefined>;
}

/**
 * @category ContractsAPI
 */
export interface CreateContractRequestBase {
  /**
   * Marlowe contracts can have staking rewards for the ADA locked in the contract.
   * Use this field to set the recipient address of those rewards
   */
  stakeAddress?: StakeAddressBech32;
  /**
   * @experimental
   * The Thread Roles capability is an implementation details of the runtime.
   * It allows you to provide a custom name if the thread role name is conflicting with other role names used.
   * @default
   *  - the Thread Role Name is "" by default.
   * @see
   *  - https://github.com/input-output-hk/marlowe-cardano/blob/main/marlowe-runtime/doc/open-roles.md
   */
  threadRoleName?: RoleName;

  /**
   * Role Token Configuration for the new contract passed in the `contract` field.
   *
   * <h4>Participants</h4>
   * <p>
   * Participants ({@link @marlowe.io/language-core-v1!index.Party | Party}) in a Marlowe Contract can be expressed in 2 ways:
   *
   *  1. **By Adressses** : When an address is fixed in the contract we don't need to provide further configuration.
   *  2. **By Roles** : When the participation is done through a Role Token, we need to define if that token is minted as part of the contract creation transaction or if it was minted beforehand.
   *
   * </p>
   *
   * <h4>Configuration Options</h4>
   * <p>
   *
   * - **When to create (mint)**
   *   - **Within the Runtime** : At the contrat creation, these defined Roles Tokens will be minted "on the fly" by the runtime.
   *   - **Without the Runtime** : before the creation, these Role Tokens are already defined (via an NFT platform, `cardano-cli`, another Marlowe Contract Created, etc.. )
   * - **How to distribute**
   *   - **Closedly** (Closed Roles) : At the creation of contract or before, the Role Tokens are released to the participants. All the participants are known at the creation and therefore we consider the participation as being closed.
   *   - **Openly** (Open Roles) : Whoever applies an input (IDeposit or IChoice) on the contract `contract` first will be identified as a participant by receiving the Role Token in their wallet. In that case, participants are unknown at the creation and the participation is open to any meeting the criteria.
   * - **With or without Metadata**
   * - **Quantities to create(Mint)** : When asking to mint the tokens within the Runtime, quantities can defined as well.
   *
   * Smart Constructors are available to ease these configuration:
   *    - {@link @marlowe.io/runtime-rest-client!contract.useMintedRoles}
   *    - {@link @marlowe.io/runtime-rest-client!contract.mintRole}
   *
   * @remarks
   *  - The Distribution can be a mix of Closed and Open Role Tokens configuration. See examples below.
   * </p>
   *
   * @example
   *
   * ```ts
   *  //////////////
   *  // #1 - Mint Role Tokens
   *  //////////////
   * const anAddressBech32 = "addr_test1qqe342swyfn75mp2anj45f8ythjyxg6m7pu0pznptl6f2d84kwuzrh8c83gzhrq5zcw7ytmqc863z5rhhwst3w4x87eq0td9ja"
   * const aMintingConfiguration =
   *   { "closed_Role_A_NFT" : mintRole(anAddressBech32)
   *   , "closed_Role_B_FT" :
   *        mintRole(
   *          anAddressBech32,
   *          5, // Quantities
   *          { "name": "closed_Role_B_FT Marlowe Role Token",
   *            "description": "These are metadata for closedRoleB",
   *            image": "ipfs://QmaQMH7ybS9KmdYQpa4FMtAhwJH5cNaacpg4fTwhfPvcwj",
   *            "mediaType": "image/png",
   *            "files": [
   *                {
   *                  "name": "icon-1000",
   *                  "mediaType": "image/webp",
   *                  "src": "ipfs://QmUbvavFxGSSEo3ipQf7rjrELDvXHDshWkHZSpV8CVdSE5"
   *                }
   *              ]
   *          })
   *   , "open_Role_C" : mkMintOpenRoleToken()
   *   , "open_Role_D" : mkMintOpenRoleToken(
   *          2, // Quantities
   *          { "name": "open_Role_D Marlowe Role Token",
   *            "description": "These are metadata for closedRoleB",
   *            image": "ipfs://QmaQMH7ybS9KmdYQpa4FMtAhwJH5cNaacpg4fTwhfPvcwj",
   *            "mediaType": "image/png",
   *            "files": [
   *                {
   *                  "name": "icon-1000",
   *                  "mediaType": "image/webp",
   *                  "src": "ipfs://QmUbvavFxGSSEo3ipQf7rjrELDvXHDshWkHZSpV8CVdSE5"
   *                }
   *              ]
   *          })
   * }
   *
   *  //////////////
   *  // #2 Use Minted Roles Tokens
   *  const aUseMintedRoleTokensConfiguration =
   *      useMintedRoles(
   *        "e68f1cea19752d1292b4be71b7f5d2b3219a15859c028f7454f66cdf",
   *        ["role_A","role_C"]
   *      )
   * ```
   *
   * @see
   * - {@link @marlowe.io/runtime-rest-client!contract.useMintedRoles}
   * - {@link @marlowe.io/runtime-rest-client!contract.mintRole}
   * - Open Roles Runtime Implementation : https://github.com/input-output-hk/marlowe-cardano/blob/main/marlowe-runtime/doc/open-roles.md
   */
  roles?: RolesConfiguration;

  /**
   * Marlowe Tags are stored as Metadata within the Transaction Metadata under the top-level Marlowe Reserved Key (`1564`).
   * Tags allows to Query created Marlowe Contracts via {@link @marlowe.io/runtime-rest-client!index.RestClient#getContracts | Get contracts }
   *
   * <h4>Properties</h4>
   *
   * 1. They aren't limited size-wise like regular metadata fields are over Cardano.
   * 2. Metadata can be associated under each tag
   *
   * @example
   * ```ts
   * const myTags : Tags = { "My Tag 1 That can be as long as I want": // Not limited to 64 bytes
   *                            { a: 0
   *                            , b : "Tag 1 content" // Limited to 64 bytes (Cardano Metadata constraint)
   *                            },
   *                         "MyTag2": { c: 0, d : "Tag 2 content"}};
   * ```
   */
  tags?: Tags;
  /**
   * Cardano Metadata about the contract creation.
   * <h4>Properties</h4>
   * <p>
   * Metadata can be expressed as a JSON object with some restrictions:
   *   - All top-level keys must be integers between 0 and 2^63 - 1.
   *   - Each metadata value is tagged with its type.
   *   - Strings must be at most 64 characters long (64 bytes) when UTF-8 is encoded.
   *   - Bytestrings are hex-encoded, with a maximum length of 64 bytes.
   *
   * Metadata aren't stored as JSON on the Cardano blockchain but are instead stored using a compact binary encoding (CBOR).
   * The binary encoding of metadata values supports three simple types:
   *    - Integers in the range `-(2^63 - 1)` to `2^63 - 1`
   *    - Strings (UTF-8 encoded)
   *    - Bytestrings
   *    - And two compound types:
   *        - Lists of metadata values
   *        - Mappings from metadata values to metadata values
   * </p>
   * It is possible to transform any JSON object into this schema (See https://developers.cardano.org/docs/transaction-metadata )
   * @see
   * https://developers.cardano.org/docs/transaction-metadata
   */
  metadata?: Metadata;

  /**
   * Minimum Lovelace value to add on the UTxO created (Representing the Marlowe Contract Created on the ledger).This value
   * is computed automatically within the Runtime, so this parameter is only necessary if you need some custom adjustment.
   *
   * <h4>Justification</h4>
   * <p>Creating a Marlowe contract over Cardano is about creating UTxO entries on the Ledger.
   *
   * To protect the ledger from growing beyond a certain size that will cost too much to maintain,
   * a constraint called "Minimum ada value requirement (minimumLovelaceUTxODeposit)" that adjust
   * the value (in ADA) of each UTxO has been added.
   *
   * The bigger the UTxOs entries are in terms of bytesize, the higher the value if minimum ADA required.</p>
   *
   * @see
   * https://docs.cardano.org/native-tokens/minimum-ada-value-requirement
   */
  minimumLovelaceUTxODeposit?: number;
}

/**
 * @category ContractsAPI
 */
export type ApplyInputsRequest = {
  inputs: Input[];
  tags?: Tags;
  metadata?: Metadata;
  invalidBefore?: ISO8601;
  invalidHereafter?: ISO8601;
};

/**
 * This Interface provides capabilities for runnning a Contract over Cardano.
 * @category ContractsAPI
 */
export interface ContractsAPI {
  /**
   * Submit to the Cardano Ledger, the Transaction(Tx) that will create the Marlowe Contract passed in the request.
   * @param createContractRequest Request parameters for creating a Marlowe Contract on Cardano
   * @returns ContractId (Marlowe id) and TxId (Cardano id) of the submitted Tx
   * @throws DecodingError
   */
  createContract(
    createContractRequest: CreateContractRequest
  ): Promise<[ContractId, TxId]>;

  /**
   * Submit to the Cardano Ledger, the Transaction(Tx) that will apply inputs to a given created contract.
   * @param contractId Contract Id where inputs will be applied
   * @param applyInputsRequest inputs to apply
   * @throws DecodingError
   */
  applyInputs(
    contractId: ContractId,
    applyInputsRequest: ApplyInputsRequest
  ): Promise<TxId>;

  /**
   * @deprecated Deprecated in favour of {@link @marlowe.io/runtime-lifecycle!api.ApplicableActionsAPI}
   */
  getApplicableInputs(
    contractId: ContractId,
    environement: Environment
  ): Promise<Next>;

  /**
   * @description
   *  Fetches all contract ids for contracts on chain that mentions an address in your wallet.
   * @throws Error | DecodingError
   */
  getContractIds(): Promise<ContractId[]>;

  /**
   * Get a list of the applied inputs for a given contract
   * @param contractId
   */
  getInputHistory(contractId: ContractId): Promise<SingleInputTx[]>;
}

export function mkContractLifecycle(
  wallet: WalletAPI,
  deprecatedRestAPI: FPTSRestAPI,
  restClient: RestClient
): ContractsAPI {
  const di = { wallet, deprecatedRestAPI, restClient };
  return {
    createContract: createContract(di),
    applyInputs: applyInputs(di),
    getApplicableInputs: getApplicableInputs(di),
    getContractIds: getContractIds(di),
    getInputHistory: getInputHistory(di),
  };
}
export const getInputHistory =
  ({ restClient }: ContractsDI) =>
  async (contractId: ContractId): Promise<SingleInputTx[]> => {
    const transactionHeaders = await restClient.getTransactionsForContract({
      contractId,
    });
    const transactions = await Promise.all(
      transactionHeaders.transactions.map((txHeader) =>
        restClient.getContractTransactionById({
          contractId,
          txId: txHeader.transactionId,
        })
      )
    );
    const sortOptionalBlock = (
      a: Option<BlockHeader>,
      b: Option<BlockHeader>
    ) => {
      if (a._tag === "None" || b._tag === "None") {
        // TODO: to avoid this error we should provide a higer level function that gets the transactions as the different
        //       status and with the appropiate values for each state.
        throw new Error("A confirmed transaction should have a valid block");
      } else {
        if (a.value.blockNo < b.value.blockNo) {
          return -1;
        } else if (a.value.blockNo > b.value.blockNo) {
          return 1;
        } else {
          return 0;
        }
      }
    };
    return transactions
      .filter((tx) => tx.status === "confirmed")
      .sort((a, b) => sortOptionalBlock(a.block, b.block))
      .map((tx) => {
        const interval = {
          from: iso8601ToPosixTime(tx.invalidBefore),
          // FIXME: The runtime method getContractTransactionById responds
          //        a cardano timeinterval (which is closed on the lower bound and
          //        open in the upper bound), and a Marlowe time interval is closed
          //        in both parts. Here I substract 1 millisecond from the open bound
          //        to get a "safe" closed bound. But the runtime should instead respond
          //        with the same interval as computed here:
          //        https://github.com/input-output-hk/marlowe-cardano/blob/9ae464a2be332a004cc4d5284fb1ccaf607fa6c7/marlowe-runtime/tx/Language/Marlowe/Runtime/Transaction/BuildConstraints.hs#L463-L479
          to: iso8601ToPosixTime(tx.invalidHereafter) - 1n,
        };
        if (tx.inputs.length === 0) {
          return [{ interval }];
        } else {
          return tx.inputs.map((input) => ({ input, interval }));
        }
      })
      .flat();
  };

export const createContract =
  ({ wallet, restClient }: ContractsDI) =>
  async (
    createContractRequest: CreateContractRequest
  ): Promise<[ContractId, TxId]> => {
    const addressesAndCollaterals = await getAddressesAndCollaterals(wallet);

    const baseRequest: BuildCreateContractTxRequestOptions = {
      version: "v1",

      changeAddress: addressesAndCollaterals.changeAddress,
      usedAddresses: addressesAndCollaterals.usedAddresses,
      collateralUTxOs: addressesAndCollaterals.collateralUTxOs,
      stakeAddress: createContractRequest.stakeAddress,

      threadRoleName: createContractRequest.threadRoleName,
      roles: createContractRequest.roles,

      tags: createContractRequest.tags,
      metadata: createContractRequest.metadata,
      minimumLovelaceUTxODeposit:
        createContractRequest.minimumLovelaceUTxODeposit,
    };

    let restClientRequest: BuildCreateContractTxRequest;
    if ("contract" in createContractRequest) {
      restClientRequest = {
        ...baseRequest,

        contract: createContractRequest.contract,
      };
    } else {
      const contractSources = await restClient.createContractSources({
        bundle: createContractRequest.bundle,
      });
      restClientRequest = {
        ...baseRequest,
        sourceId: contractSources.contractSourceId,
      };
    }
    const buildCreateContractTxResponse =
      await restClient.buildCreateContractTx(restClientRequest);
    const contractId = buildCreateContractTxResponse.contractId;

    const hexTransactionWitnessSet = await wallet.signTx(
      buildCreateContractTxResponse.tx.cborHex
    );

    await restClient.submitContract({
      contractId,
      txEnvelope: transactionWitnessSetTextEnvelope(hexTransactionWitnessSet),
    });
    return [contractId, contractIdToTxId(contractId)];
  };

const getApplicableInputs =
  ({ wallet, deprecatedRestAPI }: ContractsDI & DeprecatedRestDI) =>
  async (contractId: ContractId, environement: Environment): Promise<Next> => {
    const contractDetails = await unsafeTaskEither(
      deprecatedRestAPI.contracts.contract.get(contractId)
    );
    if (!contractDetails.state) {
      return noNext;
    } else {
      const parties = await getParties(wallet)(
        contractDetails.roleTokenMintingPolicyId
      );
      return await unsafeTaskEither(
        deprecatedRestAPI.contracts.contract.next(contractId)(environement)(
          parties
        )
      );
    }
  };

const getContractIds =
  ({ deprecatedRestAPI, wallet }: ContractsDI & DeprecatedRestDI) =>
  async (): Promise<ContractId[]> => {
    const partyAddresses = [
      await wallet.getChangeAddress(),
      ...(await wallet.getUsedAddresses()),
    ];
    const kwargs = { tags: [], partyAddresses, partyRoles: [] };
    const loop = async (
      acc: ContractId[],
      range?: ItemRange
    ): Promise<ContractId[]> => {
      const result =
        await deprecatedRestAPI.contracts.getHeadersByRange(range)(kwargs)();
      if (result._tag === "Left") throw result.left;
      const response = result.right;
      const contractIds = [
        ...acc,
        ...response.contracts.map(({ contractId }) => contractId),
      ];
      return response.page.next
        ? loop(contractIds, response.page.next)
        : contractIds;
    };
    return loop([]);
  };

const getParties: (
  walletApi: WalletAPI
) => (roleTokenMintingPolicyId: PolicyId) => Promise<Party[]> =
  (walletAPI) => async (roleMintingPolicyId) => {
    const changeAddress: Party = await walletAPI
      .getChangeAddress()
      .then((addressBech32) => ({ address: addressBech32 }));
    const usedAddresses: Party[] = await walletAPI
      .getUsedAddresses()
      .then((addressesBech32) =>
        addressesBech32.map((addressBech32) => ({
          address: addressBech32,
        }))
      );
    const roles: Party[] = (await walletAPI.getTokens())
      .filter((token) => token.assetId.policyId == roleMintingPolicyId)
      .map((token) => ({ role_token: token.assetId.policyId }));
    return roles.concat([changeAddress]).concat(usedAddresses);
  };

export const applyInputs =
  ({ wallet, restClient }: ContractsDI) =>
  async (
    contractId: ContractId,
    applyInputsRequest: ApplyInputsRequest
  ): Promise<TxId> => {
    const addressesAndCollaterals = await getAddressesAndCollaterals(wallet);
    const envelope = await restClient.applyInputsToContract({
      contractId,
      changeAddress: addressesAndCollaterals.changeAddress,
      usedAddresses: addressesAndCollaterals.usedAddresses,
      collateralUTxOs: addressesAndCollaterals.collateralUTxOs,
      inputs: applyInputsRequest.inputs,
      invalidBefore: applyInputsRequest.invalidBefore,
      invalidHereafter: applyInputsRequest.invalidHereafter,
      version: "v1",
      metadata: applyInputsRequest.metadata,
      tags: applyInputsRequest.tags,
    });
    const signed = await wallet.signTx(envelope.tx.cborHex);
    await restClient.submitContractTransaction({
      contractId,
      transactionId: envelope.transactionId,
      hexTransactionWitnessSet: signed,
    });
    return envelope.transactionId;
  };
