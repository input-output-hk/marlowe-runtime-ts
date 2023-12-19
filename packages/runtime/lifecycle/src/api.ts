import { WalletAPI, WalletDI } from "@marlowe.io/wallet/api";
import {
  AssetId,
  ContractId,
  Metadata,
  PayoutAvailable,
  PayoutId,
  PayoutWithdrawn,
  StakeAddressBech32,
  Tags,
  TxId,
} from "@marlowe.io/runtime-core";
import { RestDI } from "@marlowe.io/runtime-rest-client";
import { RolesConfiguration } from "@marlowe.io/runtime-rest-client/contract";
import { ISO8601 } from "@marlowe.io/adapter/time";
import {
  Contract,
  Environment,
  Input,
  RoleName,
} from "@marlowe.io/language-core-v1";
import { Next } from "@marlowe.io/language-core-v1/next";

export type RuntimeLifecycle = {
  wallet: WalletAPI;
  contracts: ContractsAPI;
  payouts: PayoutsAPI;
};

/**
 *
 * @description Dependency Injection for the Contract API
 * @hidden
 */
export type ContractsDI = WalletDI & RestDI;

export type CreateContractRequest = {
  /**
   * A Marlowe Contract to create over Cardano
   */
  contract: Contract;

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
                  "description": "These are metadata for closedRoleB",
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
                  "description": "These are metadata for closedRoleB",
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
};

export type ApplyInputsRequest = {
  inputs: Input[];
  tags?: Tags;
  metadata?: Metadata;
  invalidBefore?: ISO8601;
  invalidHereafter?: ISO8601;
};
/**
 * This Interface provides capabilities for runnning a Contract over Cardano.
 */
export interface ContractsAPI {
  /**
   * Submit to the Cardano Ledger, the Transaction(Tx) that will create the Marlowe Contract passed in the request.
   * @param createContractRequest Request parameters for creating a Marlowe Contract on Cardano
   * @returns ContractId (Marlowe id) and TxId (Cardano id) of the submitted Tx
   * @throws DecodingError
   */
  submitCreateContract(
    createContractRequest: CreateContractRequest
  ): Promise<[ContractId, TxId]>;

  /**
   * Submit to the Cardano Ledger, the Transaction(Tx) that will apply inputs to a given created contract.
   * @param contractId Contract Id where inputs will be applied
   * @param applyInputsRequest inputs to apply
   * @throws DecodingError
   */
  submitApplyInputs(
    contractId: ContractId,
    applyInputsRequest: ApplyInputsRequest
  ): Promise<TxId>;

  /**
   * @experimental
   * Provide Applicability and Reducibility Information moving forward for a given contract connected to a wallet.
   * @description
   *  This piece of information should help you :
   *  - 1) Deciding which inputs to provide for the current state of the given contract
   *  - 2) Constructing the inputs to apply for a given contract
   * @param contractId Contract Id of a created contract
   * @param environement Time interval in which inputs would like to be applied
   * @throws DecodingError
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
}
export type PayoutsDI = WalletDI & RestDI;

export interface PayoutsAPI {
  /**
   * Provide All the availaible payouts for the connected Wallet
   * @param filters provide filtering capabilities on the available payouts returned
   * @throws DecodingError
   */
  available(filters?: Filters): Promise<PayoutAvailable[]>;

  /**
   * TODO: comment
   * @throws DecodingError
   */
  withdraw(payoutIds: PayoutId[]): Promise<void>;
  /**
   * Provide All the withdrawn payouts for the connected Wallet
   * @param filters provide filtering capabilities on the withdrawn payouts returned
   * @throws DecodingError
   */
  withdrawn(filters?: Filters): Promise<PayoutWithdrawn[]>;
}

/**
 * Provide filtering capabilities on the payouts returned only by ContractIds
 * @param byContractIds filters the payouts by contract Ids
 * @throws DecodingError
 */
export const onlyByContractIds = (contractIds: ContractId[]) =>
  ({
    byContractIds: contractIds,
    byMyRoleTokens: (myRoles) => myRoles,
  } as Filters);

/**
 * Provide filtering capabilities on the payouts returned
 * @param byContractIds filters the payouts by contract Ids
 * @param byMyRoleTokens filters the payouts by role tokens owned in the connected wallet
 * @throws DecodingError
 */
export type Filters = {
  byContractIds: ContractId[];
  byMyRoleTokens: (myRolesOnWallet: AssetId[]) => AssetId[];
};
