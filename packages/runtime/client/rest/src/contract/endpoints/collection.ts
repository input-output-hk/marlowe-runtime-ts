import { AxiosInstance } from "axios";

import * as t from "io-ts/lib/index.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { pipe } from "fp-ts/lib/function.js";
import * as E from "fp-ts/lib/Either.js";
import * as A from "fp-ts/lib/Array.js";
import { formatValidationErrors } from "jsonbigint-io-ts-reporters";
import { stringify } from "qs";
import { assertGuardEqual, proxy } from "@marlowe.io/adapter/io-ts";
import { Contract, RoleName } from "@marlowe.io/language-core-v1";
import * as G from "@marlowe.io/language-core-v1/guards";
import { MarloweVersion } from "@marlowe.io/language-core-v1/version";

import * as HTTP from "@marlowe.io/adapter/http";
import { DecodingError } from "@marlowe.io/adapter/codec";

import {
  Tag,
  Tags,
  TagsGuard,
  MetadataGuard,
  Metadata,
  TextEnvelope,
  TextEnvelopeGuard,
  unTxOutRef,
  AddressesAndCollaterals,
  AddressBech32,
  TxOutRef,
  AssetId,
  StakeAddressBech32,
  unStakeAddressBech32,
  SourceId,
  SourceIdGuard,
  AddressBech32Guard,
  ContractId,
  ContractIdGuard,
} from "@marlowe.io/runtime-core";
import { ContractHeader, ContractHeaderGuard } from "../header.js";
import { RolesConfiguration, RolesConfigurationGuard } from "../rolesConfigurations.js";
import { ItemRange, ItemRangeGuard, Page, PageGuard } from "../../pagination.js";

/**
 * Request options for the {@link index.RestClient#getContracts | Get contracts } endpoint
 * @category Endpoint : Get Contracts
 */
export interface GetContractsRequest {
  /**
   * Optional pagination request. Note that when you call {@link index.RestClient#getContracts | Get contracts }
   * the response includes the next and previous range headers.
   */
  range?: ItemRange;
  /**
   * Optional tags to filter the contracts by.
   */
  // QUESTION: @Jamie or @N.H, a tag is marked as string, but when creating a contract you need to pass a key and a value, what is this
  //           string supposed to be? I have some contracts with tag "{SurveyContract: CryptoPall2023}" that I don't know how to search for.
  tags?: Tag[];
  /**
   * Optional partyAddresses to filter the contracts by.
   */
  partyAddresses?: AddressBech32[];
  /**
   * Optional partyRoles to filter the contracts by.
   */
  partyRoles?: AssetId[];
}

export const GetContractsRequestGuard = assertGuardEqual(
  proxy<GetContractsRequest>(),
  t.partial({
    range: ItemRangeGuard,
    tags: t.array(Tag),
    partyAddresses: t.array(AddressBech32Guard),
    partyRoles: t.array(AssetId),
  }) as t.Type<GetContractsRequest>
);

export type GETHeadersByRange = (
  range?: ItemRange
) => (kwargs: {
  tags: Tag[];
  partyAddresses: AddressBech32[];
  partyRoles: AssetId[];
}) => TE.TaskEither<Error | DecodingError, GetContractsResponse>;

const roleToParameter = (roleToken: AssetId) => `${roleToken.policyId}.${roleToken.assetName}`;

/**
 * @see {@link https://docs.marlowe.iohk.io/api/get-contracts}
 */
export const getHeadersByRangeViaAxios: (axiosInstance: AxiosInstance) => GETHeadersByRange =
  (axiosInstance) =>
  (range) =>
  ({ tags, partyAddresses, partyRoles }) =>
    pipe(
      {
        url:
          "/contracts?" +
          stringify(
            {
              tag: tags,
              partyAddress: partyAddresses,
              partyRole: partyRoles.map(roleToParameter),
            },
            { indices: false }
          ),
        configs: range ? { headers: { Range: range } } : {},
      },
      ({ url, configs }) => HTTP.GetWithDataAndHeaders(axiosInstance)(url, configs),
      TE.map(([headers, data]) => ({
        data: data,
        page: {
          current: headers["content-range"],
          next: headers["next-range"],
          total: Number(headers["total-count"]).valueOf(),
        },
      })),
      TE.chainW((data) => TE.fromEither(E.mapLeft(formatValidationErrors)(GETByRangeRawResponseGuard.decode(data)))),
      TE.map((rawResponse) => ({
        contracts: pipe(
          rawResponse.data.results,
          A.map((result) => result.resource)
        ), // All logic instead of Any, TODO : Add the flexibility to chose between Any and All
        page: rawResponse.page,
      }))
    );

export type GETByRangeRawResponse = t.TypeOf<typeof GETByRangeRawResponseGuard>;
export const GETByRangeRawResponseGuard = t.type({
  data: t.type({
    results: t.array(
      t.type({
        links: t.type({ contract: t.string, transactions: t.string }),
        resource: ContractHeaderGuard,
      })
    ),
  }),
  page: PageGuard,
});

/**
 * Represents the response of the {@link index.RestClient#getContracts | Get contracts } endpoint
 * @remarks
 *  - Contracts are paginated and the response is self-sufficient to be able to navigate through pages
 *  - Only minimal Contract information is provided (`ContractHeader`)
 * @category Endpoint : Get Contracts
 */
export interface GetContractsResponse {
  contracts: ContractHeader[];
  page: Page;
}

/**
 * This is a {@link !io-ts-usage | Dynamic type validator} for {@link GetContractsResponse}.
 * @category Validator
 * @category GetContractsResponse
 * @hidden
 */
export const GetContractsResponseGuard = assertGuardEqual(
  proxy<GetContractsResponse>(),
  t.type({
    contracts: t.array(ContractHeaderGuard),
    page: PageGuard,
  })
);

/**
 * Either a non-merkleized Marlowe Contract or a merkleized One
 * @category Endpoint : Build Create Contract Tx
 */
export type ContractOrSourceId = Contract | SourceId;

/**
 * Guard for ContractOrSourceId type
 * @category Endpoint : Build Create Contract Tx
 */
export const ContractOrSourceIdGuard: t.Type<ContractOrSourceId> = t.union([G.Contract, SourceIdGuard]);

/**
 * Request for the {@link index.RestClient#buildCreateContractTx | Build Create Contract Tx } endpoint using a source Id (merkleized contract)
 * @category Endpoint : Build Create Contract Tx
 */
export type BuildCreateContractTxRequestWithContract = {
  /**
   * A Marlowe Contract to create over Cardano
   */
  contract: Contract;
} & BuildCreateContractTxRequestOptions;

export const BuildCreateContractTxRequestOptionsGuard = assertGuardEqual(
  proxy<BuildCreateContractTxRequestOptions>(),
  t.intersection([
    t.type({ changeAddress: AddressBech32Guard, version: MarloweVersion }),
    t.partial({
      roles: RolesConfigurationGuard,
      threadRoleName: G.RoleName,
      minimumLovelaceUTxODeposit: t.number,
      metadata: MetadataGuard,
      tags: TagsGuard,
      collateralUTxOs: t.array(TxOutRef),
      usedAddresses: t.array(AddressBech32Guard),
      stakeAddress: StakeAddressBech32,
    }),
  ])
);

export const BuildCreateContractTxRequestWithContractGuard = assertGuardEqual(
  proxy<BuildCreateContractTxRequestWithContract>(),
  t.intersection([t.type({ contract: G.Contract }), BuildCreateContractTxRequestOptionsGuard])
);

/**
 * Request for the {@link index.RestClient#buildCreateContractTx | Build Create Contract Tx } endpoint using a contract
 * @category Endpoint : Build Create Contract Tx
 */
export type BuildCreateContractTxRequestWithSourceId = {
  /**
   * A merkleized Contract (referred by its source Id) to create over Cardano
   * @see Large/Deep Contracts Support (Contract Merkleization) and `@marlowe.io/language-core`
   */
  sourceId: SourceId;
} & BuildCreateContractTxRequestOptions;

export const BuildCreateContractTxRequestWithSourceIdGuard = assertGuardEqual(
  proxy<BuildCreateContractTxRequestWithSourceId>(),
  t.intersection([t.type({ sourceId: SourceIdGuard }), BuildCreateContractTxRequestOptionsGuard])
);

/**
 * Request options for the {@link index.RestClient#buildCreateContractTx | Build Create Contract Tx } endpoint
 * @category Endpoint : Build Create Contract Tx
 * @example
 * - Minimal Simple Contract Close
 * ```json
 *  { "changeAddress" : "addr_test1qqe342swyfn75mp2anj45f8ythjyxg6m7pu0pznptl6f2d84kwuzrh8c83gzhrq5zcw7ytmqc863z5rhhwst3w4x87eq0td9ja",
 *    "contract" : "close",
 *    "tags" : {"ts-sdk.documentation.example" : {"infoA" : 5} },
 *    "version" : "v1"
 *  }
 * ```
 * - Simple Contract Close with Optional Fields
 * ```json
 *  { "changeAddress" : "addr_test1qqe342swyfn75mp2anj45f8ythjyxg6m7pu0pznptl6f2d84kwuzrh8c83gzhrq5zcw7ytmqc863z5rhhwst3w4x87eq0td9ja",
 *    "usedAddresses": ["addr_test1qqe342swyfn75mp2anj45f8ythjyxg6m7pu0pznptl6f2d84kwuzrh8c83gzhrq5zcw7ytmqc863z5rhhwst3w4x87eq0td9ja"],
 *    "collateralUTxOs": [],
 *    "contract" : "close",
 *    "tags" : {"ts-sdk.documentation.example" : {"infoA" : 5} },
 *    "minimumLovelaceUTxODeposit" : 3000000,
 *    "threadRoleName" : "ThreadRoleToken",
 *    "version" : "v1"
 *  }
 * ```
 * - Swap Contract Copy/Pasted from Playground with Role Token Configuration  (NFT Open Role for Both)
 * ```json
 *  { "changeAddress" : "addr_test1qqe342swyfn75mp2anj45f8ythjyxg6m7pu0pznptl6f2d84kwuzrh8c83gzhrq5zcw7ytmqc863z5rhhwst3w4x87eq0td9ja",
 *    "usedAddresses": ["addr_test1qqe342swyfn75mp2anj45f8ythjyxg6m7pu0pznptl6f2d84kwuzrh8c83gzhrq5zcw7ytmqc863z5rhhwst3w4x87eq0td9ja"],
 *    "collateralUTxOs": [],
 *    "contract" : {"when":[{"then":{"when":[{"then":{"token":{"token_name":"","currency_symbol":""},"to":{"party":{"role_token":"Dollar provider"}},"then":{"token":{"token_name":"dollar","currency_symbol":"85bb65"},"to":{"party":{"role_token":"Ada provider"}},"then":"close","pay":0,"from_account":{"role_token":"Dollar provider"}},"pay":{"times":0,"multiply":1000000},"from_account":{"role_token":"Ada provider"}},"case":{"party":{"role_token":"Dollar provider"},"of_token":{"token_name":"dollar","currency_symbol":"85bb65"},"into_account":{"role_token":"Dollar provider"},"deposits":0}}],"timeout_continuation":"close","timeout":1701773934770},"case":{"party":{"role_token":"Ada provider"},"of_token":{"token_name":"","currency_symbol":""},"into_account":{"role_token":"Ada provider"},"deposits":{"times":0,"multiply":1000000}}}],"timeout_continuation":"close","timeout":1701772134770},
 *    "tags" : {"ts-sdk.documentation.example" : {"infoA" : 5} },
 *    "roles" : {"Ada provider" : {"recipients": {"OpenRole" : 1} }
 *              ,"Dollar provider" : {"recipients": {"OpenRole" : 1} } },
 *    "minimumLovelaceUTxODeposit" : 3000000,
 *    "threadRoleName" : "ThreadRoleToken",
 *    "version" : "v1"
 *  }
 * ```
 */
export type BuildCreateContractTxRequest =
  | BuildCreateContractTxRequestWithContract
  | BuildCreateContractTxRequestWithSourceId;

export const BuildCreateContractTxRequestGuard = assertGuardEqual(
  proxy<BuildCreateContractTxRequest>(),
  t.union([BuildCreateContractTxRequestWithContractGuard, BuildCreateContractTxRequestWithSourceIdGuard])
);

/**
 * Request options for the {@link index.RestClient#buildCreateContractTx | Build Create Contract Tx } endpoint
 * @category Endpoint : Build Create Contract Tx
 */
export interface BuildCreateContractTxRequestOptions {
  /**
   * Marlowe contracts can have staking rewards for the ADA locked in the contract.
   * Use this field to set the recipient address of those rewards
   */
  stakeAddress?: StakeAddressBech32;
  /**
   * The Marlowe Runtime utilizes this mandatory field and any additional addresses provided in `usedAddresses`
   * to search for UTxOs that can be used to balance the contract creation transaction.
   *
   * Any change from the creation transaction will be sent here.
   * @see WalletAPI function {@link @marlowe.io/wallet!api.WalletAPI#getChangeAddress}
   * @see WalletAPI function {@link @marlowe.io/wallet!api.WalletAPI#getUsedAddresses}
   * @see {@link https://academy.glassnode.com/concepts/utxo#change-in-utxo-models}
   */
  changeAddress: AddressBech32;
  /**
   * The Marlowe Runtime utilizes the mandatory `changeAddress` and any additional addresses provided here
   * to search for UTxOs that can be used to balance the contract creation transaction.
   *
   * @remarks
   *
   * 1. When using single address wallets like Nami, it is not necesary to fill this field.
   * 2. If an address was provided in the `changeAddress` field, it is redundant to include it here (but it doesn't fail).
   *
   * @see WalletAPI function {@link @marlowe.io/wallet!api.WalletAPI#getChangeAddress}
   * @see WalletAPI function {@link @marlowe.io/wallet!api.WalletAPI#getUsedAddresses}
   */
  usedAddresses?: AddressBech32[];
  /**
   * UTxOs provided as collateral in case the Tx built will unexpectedly fail at the submit phase.
   *
   * <h4>Justification</h4>
   * <p>
   * The collateral mechanism is an important feature that has been designed to ensure
   * successful smart contract execution.
   *
   * Collateral is used to guarantee that nodes are compensated for their work in case phase-2 validation fails.
   * Thus, collateral is the monetary guarantee a user gives to assure that the contract has been carefully designed
   * and thoroughly tested.
   *
   * Collateral amount is specified at the time of constructing the transaction.
   * Not directly, but by adding collateral inputs to the transaction.
   *
   * The total balance in the UTXOs
   * corresponding to these specially marked inputs is the transaction’s collateral amount.
   *
   * If the user fulfills the conditions of the guarantee, and a contract gets executed, the collateral is safe.
   * </p>
   * @see
   * https://docs.cardano.org/smart-contracts/plutus/collateral-mechanism
   */
  collateralUTxOs?: TxOutRef[];

  /**
   * Marlowe Tags are stored as Metadata within the Transaction Metadata under the top-level Marlowe Reserved Key (`1564`).
   * Tags allows to Query created Marlowe Contracts via {@link index.RestClient#getContracts | Get contracts }
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
   *   - Strings must be at most  64 characters long (64 bytes) when UTF-8 is encoded.
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
   * @see
   * https://docs.cardano.org/native-tokens/minimum-ada-value-requirement
   */
  minimumLovelaceUTxODeposit?: number;

  /**
   * @experimental
   * The Thread Roles capability is an implementation details of the runtime.
   * It allows you to provide a custom name if the thread role name is conflicting with other role names used.
   * @default
   *  - the Thread Role Name is "" by default.
   */
  threadRoleName?: RoleName;

  /**
   * Role Token Configuration for the new contract passed in the `contractOrSourceId` field.
   *
   * <h4>Participants</h4>
   * <p>
   * Participants ({@link @marlowe.io/language-core-v1!index.Party | Party}) in a Marlowe Contract can be expressed in 2 ways:
   *
   *  1. **By Adressses** : When an address is fixed in the contract we don't need to provide further configuration.
   *  2. **By Roles** : When the participation is done through a Role Token, we need to define if that token is minted as part of the contract creation transaction or if it was minted beforehand.
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
   *   - **Openly** (Open Roles) : Whoever applies an input (IDeposit or IChoice) on the contract `contractOrSourceId` first will be identified as a participant by receiving the Role Token in their wallet. In that case, participants are unknown at the creation and the participation is open to any meeting the criteria.
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
   *   , "open_Role_C" : mintRole(openRole)
   *   , "open_Role_D" : mintRole(
   *          openRole,
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
   * The Marlowe validator version to use.
   */
  version: MarloweVersion;
}

export type BuildCreateContractTxEndpoint = (
  postContractsRequest: PostContractsRequest,
  addressesAndCollaterals: AddressesAndCollaterals,
  stakeAddress?: StakeAddressBech32
) => TE.TaskEither<Error | DecodingError, BuildCreateContractTxResponse>;

/**
 * @hidden
 */
export type PostContractsRequest = t.TypeOf<typeof PostContractsRequest>;
/**
 * @hidden
 */
export const PostContractsRequest = t.intersection([
  t.type({
    version: MarloweVersion,
    contract: ContractOrSourceIdGuard,
    tags: TagsGuard,
    metadata: MetadataGuard,
  }),
  t.partial({ roles: RolesConfigurationGuard }),
  t.partial({ threadTokenName: G.RoleName }),
  t.partial({ minUTxODeposit: t.number }),
]);

/**
 * Response for the {@link index.RestClient#buildCreateContractTx | Build Create Contract Tx } endpoint
 * @category Endpoint : Build Create Contract Tx
 */
export interface BuildCreateContractTxResponse {
  /**
   * This is the ID the contract will have after it is signed and submitted.
   */
  contractId: ContractId;
  /**
   * An array of possible errors that the contract might have.
   * @see {@link https://github.com/input-output-hk/marlowe-cardano/blob/81d1e81ca2b40e06c794ad7d97ed4d138f60ab24/marlowe/src/Language/Marlowe/Analysis/Safety/Types.hs#L110}
   */
  // TODO: type this
  safetyErrors: unknown[];
  /**
   * The unsigned transaction that will be used to create the contract.
   * @see {@link @marlowe.io/wallet!api.WalletAPI#signTx}
   * @see {@link index.RestClient#submitContract}
   */
  // QUESTION: Should we rename the property or the type to indicate that is unsigned?
  tx: TextEnvelope;
}

/**
 * @hidden
 */
const CreateContractResponseGuard = assertGuardEqual(
  proxy<BuildCreateContractTxResponse>(),
  t.type({
    contractId: ContractIdGuard,
    safetyErrors: t.UnknownArray,
    tx: TextEnvelopeGuard,
  })
);

export type PostResponse = t.TypeOf<typeof PostResponse>;
export const PostResponse = t.type({
  links: t.type({ contract: t.string }),
  resource: CreateContractResponseGuard,
});
/**
 * @see {@link https://docs.marlowe.iohk.io/api/create-contracts}
 */
export const postViaAxios: (axiosInstance: AxiosInstance) => BuildCreateContractTxEndpoint =
  (axiosInstance) => (postContractsRequest, addressesAndCollaterals, stakeAddress) =>
    pipe(
      HTTP.Post(axiosInstance)("/contracts", postContractsRequest, {
        headers: {
          Accept: "application/vendor.iog.marlowe-runtime.contract-tx-json",
          "Content-Type": "application/json",
          ...(stakeAddress && {
            "X-Stake-Address": unStakeAddressBech32(stakeAddress),
          }),
          "X-Change-Address": addressesAndCollaterals.changeAddress,
          "X-Address": pipe(addressesAndCollaterals.usedAddresses, (a) => a.join(",")),
          "X-Collateral-UTxO": pipe(addressesAndCollaterals.collateralUTxOs, A.map(unTxOutRef), (a) => a.join(",")),
        },
      }),
      TE.chainW((data) => TE.fromEither(E.mapLeft(formatValidationErrors)(PostResponse.decode(data)))),
      TE.map((payload) => payload.resource)
    );
