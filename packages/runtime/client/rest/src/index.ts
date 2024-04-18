/**
 * This is the main entry point of the @marlowe.io/runtime-rest-client package.
 * You can import it like this:
 *
 * ```ts
 * import { mkRestClient } from "@marlowe.io/runtime-rest-client";
 * ```
 * @packageDocumentation
 */

import axios from "axios";
import * as TE from "fp-ts/lib/TaskEither.js";
import * as O from "fp-ts/lib/Option.js";
import * as t from "io-ts/lib/index.js";

import { MarloweJSONCodec } from "@marlowe.io/adapter/codec";

import * as Payouts from "./payout/endpoints/collection.js";
import * as Payout from "./payout/endpoints/singleton.js";

import * as Withdrawal from "./withdrawal/endpoints/singleton.js";
import * as Withdrawals from "./withdrawal/endpoints/collection.js";
import * as Contract from "./contract/endpoints/singleton.js";
import * as Contracts from "./contract/endpoints/collection.js";
import * as Transaction from "./contract/transaction/endpoints/singleton.js";
import * as Transactions from "./contract/transaction/endpoints/collection.js";
import * as Sources from "./contract/endpoints/sources.js";
import * as Next from "./contract/next/endpoint.js";
import { unsafeTaskEither } from "@marlowe.io/adapter/fp-ts";
import { ContractDetails } from "./contract/details.js";
import { TransactionDetails } from "./contract/transaction/details.js";
import { RuntimeStatus, healthcheck } from "./runtime/status.js";
import { CompatibleRuntimeVersionGuard, RuntimeVersion } from "./runtime/version.js";
import { InvalidTypeError, strictDynamicTypeCheck } from "@marlowe.io/adapter/io-ts";

export { Page, ItemRange, ItemRangeGuard, ItemRangeBrand, PageGuard } from "./pagination.js";

export { RuntimeStatus, RuntimeVersion, Tip, CompatibleRuntimeVersion } from "./runtime/index.js";

/**
 * The RestClient offers a simple abstraction for the {@link https://docs.marlowe.iohk.io/api/ | Marlowe Runtime REST API}  endpoints.
 * You can create an instance of the RestClient using the {@link mkRestClient} function.
 * ```
 * import { mkRestClient } from "@marlowe.io/runtime-rest-client";
 * const restClient = mkRestClient("http://localhost:8080");
 * const isHealthy = await restClient.healthcheck();
 *```
 *
 * @remarks
 * This version of the RestClient targets version `0.0.5` of the Marlowe Runtime.
 */
export interface RestClient {
  /**
   * Runtime Healthcheck checks if the Marlowe API is up and running.
   * It also provides a Set of Runtime Environment information (Tips, NetworkId and Runtime Version Deployed)
   * @see {@link https://docs.marlowe.iohk.io/api/health-check-endpoint | The backend documentation}
   */
  healthcheck(): Promise<RuntimeStatus>;

  /**
   * Returns the version of the connected runtime.
   */
  version(): Promise<RuntimeVersion>;

  /**
   * Gets a paginated list of contracts {@link contract.ContractHeader }
   * @param request Optional filtering and pagination options.
   * @throws DecodingError If the response from the server can't be decoded
   * @see {@link https://docs.marlowe.iohk.io/api/get-contracts  | The backend documentation}
   */
  getContracts(request?: Contracts.GetContractsRequest): Promise<Contracts.GetContractsResponse>;

  /**
   * Builds an unsigned transaction to create an instance of a Marlowe Contract.
   *
   * @param request Request parameters including the Contract to create, role information, metadata, etc.
   * @returns An object with the CBOR encoded transaction to sign (using the {@link @marlowe.io/wallet!api.WalletAPI#signTx} function) and submit to the blockchain (using the TODO method).
   * @throws DecodingError - If the response from the server can't be decoded
   * @see {@link https://docs.marlowe.iohk.io/api/create-a-new-contract | The backend documentation}
   */
  buildCreateContractTx(
    request: Contracts.BuildCreateContractTxRequest
  ): Promise<Contracts.BuildCreateContractTxResponse>;

  /**
   * Uploads a marlowe-object bundle to the runtime, giving back the hash of the main contract and the hashes of the intermediate objects.
   * @param bundle Contains a list of object types and a main contract reference
   */
  createContractSources(request: Sources.CreateContractSourcesRequest): Promise<Sources.CreateContractSourcesResponse>;

  /**
   * Gets the contract associated with given source id
   * @throws DecodingError - If the response from the server can't be decoded
   * @see {@link https://docs.marlowe.iohk.io/api/get-contract-source-by-id | The backend documentation}
   */
  getContractSourceById(request: Sources.GetContractBySourceIdRequest): Promise<Sources.GetContractBySourceIdResponse>;

  /**
   * Get the contract source IDs which are adjacent to a contract source (they appear directly in the contract source).
   * @throws DecodingError - If the response from the server can't be decoded
   * @see {@link https://docs.marlowe.iohk.io/api/get-adjacent-contract-source-i-ds-by-id | The backend documentation}
   */
  getContractSourceAdjacency(
    request: Sources.GetContractSourceAdjacencyRequest
  ): Promise<Sources.GetContractSourceAdjacencyResponse>;

  /**
   * Get the contract source IDs which appear in the full hierarchy of a contract source (including the ID of the contract source itself).
   * @throws DecodingError - If the response from the server can't be decoded
   * @see {@link https://docs.marlowe.iohk.io/api/get-contract-source-closure-by-id | The backend documentation}
   */
  getContractSourceClosure(
    request: Sources.GetContractSourceClosureRequest
  ): Promise<Sources.GetContractSourceClosureResponse>;

  /**
   * Get inputs which could be performed on a contract within a time range by the requested parties.
   * @throws DecodingError - If the response from the server can't be decoded
   * @see {@link https://docs.marlowe.iohk.io/api/get-next-contract-steps | The backend documentation}
   */
  getNextStepsForContract(request: Next.GetNextStepsForContractRequest): Promise<Next.GetNextStepsForContractResponse>;

  /**
   * Gets a single contract by id
   * @param contractId The id of the contract to get
   * @throws DecodingError - If the response from the server can't be decoded
   * @see {@link https://docs.marlowe.iohk.io/api/get-contract-by-id | The backend documentation}
   */
  getContractById(request: Contract.GetContractByIdRequest): Promise<ContractDetails>;

  /**
   * Submits a signed contract creation transaction
   * @see {@link https://docs.marlowe.iohk.io/api/submit-contract-to-chain | The backend documentation}
   */
  submitContract(request: Contract.SubmitContractRequest): Promise<void>;

  /**
   * Gets a paginated list of  {@link contract.TxHeader } for a given contract.
   * @see {@link https://docs.marlowe.iohk.io/api/get-transactions-for-contract | The backend documentation }
   */
  // DISCUSSION: What should this return when contractId is not found? Currently it throws an exception
  //             with an AxiosError 404, we could return a nullable value or wrap the error into a custom
  //             ContractNotFound error and specify it in the docs.
  getTransactionsForContract(
    request: Transactions.GetTransactionsForContractRequest
  ): Promise<Transactions.GetTransactionsForContractResponse>;

  /**
   * Create an unsigned transaction which applies inputs to a contract.
   * @see {@link https://docs.marlowe.iohk.io/api/apply-inputs-to-contract | The backend documentation}
   */
  // TODO: Jamie, remove the `s from the end of the endpoint name in the docs site
  // DISCUSSION: @Jamie, @N.H: Should this be called `buildApplyInputsToContractTx` instead? As it is not applying inputs to the
  //             contract, rather it is creating the transaction to be signed
  applyInputsToContract(
    request: Transactions.ApplyInputsToContractRequest
  ): Promise<Transactions.TransactionTextEnvelope>;

  //   getTransactionById: Transaction.GET; // - https://docs.marlowe.iohk.io/api/get-transaction-by-id
  /**
   * Submit a signed transaction (generated with {@link @marlowe.io/runtime-rest-client!index.RestClient#applyInputsToContract} and signed with the {@link @marlowe.io/wallet!api.WalletAPI#signTx} procedure) that applies inputs to a contract.
   * @see {@link https://docs.marlowe.iohk.io/api/submit-contract-input-application | The backend documentation}
   */
  submitContractTransaction(request: Transaction.SubmitContractTransactionRequest): Promise<void>;

  /**
   * Gets full transaction details for a specific applyInput transaction of a contract
   * @param contractId Identifies the contract
   * @param txId Identifies a transaction for the contract
   * @throws DecodingError - If the response from the server can't be decoded
   * @see {@link https://docs.marlowe.iohk.io/api/get-contract-transaction-by-id | The backend documentation}
   */
  getContractTransactionById(request: Transaction.GetContractTransactionByIdRequest): Promise<TransactionDetails>;
  //   submitTransaction: Transaction.PUT; // - Jamie is it this one? https://docs.marlowe.iohk.io/api/create-transaction-by-id? If so, lets unify

  /**
   * Build an unsigned transaction (sign with the {@link @marlowe.io/wallet!api.WalletAPI#signTx} procedure) which withdraws available payouts from a contract (when applied with the {@link @marlowe.io/runtime-rest-client!index.RestClient#submitWithdrawal} procedure).
   * @see {@link https://docs.marlowe.iohk.io/api/withdraw-payouts | The backend documentation}
   */
  // TODO: Jamie, remove the `s from the end of the endpoint name in the docs site
  // DISCUSSION: @Jamie, @N.H: Should this be called `buildWithdrawPayoutsTx` instead? As it is not withdrawing the
  //             payout, rather it is creating the transaction to be signed
  withdrawPayouts(request: Withdrawals.WithdrawPayoutsRequest): Promise<Withdrawals.WithdrawPayoutsResponse>;

  /**
   * Get published withdrawal transactions.
   * @see {@link https://docs.marlowe.iohk.io/api/get-withdrawals | The backend documentation}
   */
  getWithdrawals(request?: Withdrawals.GetWithdrawalsRequest): Promise<Withdrawals.GetWithdrawalsResponse>;

  //   createWithdrawal: Withdrawals.POST; // - https://docs.marlowe.iohk.io/api/create-withdrawals
  /**
   * Get published withdrawal transaction by ID.
   * @see {@link https://docs.marlowe.iohk.io/api/get-withdrawal-by-id | The backend documentation}
   */
  getWithdrawalById(request: Withdrawal.GetWithdrawalByIdRequest): Promise<Withdrawal.GetWithdrawalByIdResponse>;
  /**
   * Submit a signed transaction (generated with {@link @marlowe.io/runtime-rest-client!index.RestClient#withdrawPayouts} and signed with the {@link @marlowe.io/wallet!api.WalletAPI#signTx} procedure) that withdraws available payouts from a contract.
   * @see {@link https://docs.marlowe.iohk.io/api/submit-payout-withdrawal | The backend documentation}
   */
  submitWithdrawal(request: Withdrawal.SubmitWithdrawalRequest): Promise<void>;

  /**
   * Get payouts to parties from role-based contracts.
   * @see {@link https://docs.marlowe.iohk.io/api/get-role-payouts | The backend documentation}
   */
  getPayouts(request: Payouts.GetPayoutsRequest): Promise<Payouts.GetPayoutsResponse>;

  /**
   * Get payout information associated with payout ID
   * @see {@link https://docs.marlowe.iohk.io/api/get-payout-by-id | The backend documentation}
   */
  getPayoutById(request: Payout.GetPayoutByIdRequest): Promise<Payout.GetPayoutByIdResponse>;
}

function mkRestClientArgumentDynamicTypeCheck(baseURL: unknown, strict: boolean): baseURL is string {
  return strict ? typeof baseURL === "string" : true;
}

function withDynamicTypeCheck<T, G>(
  arg: any,
  decode: (x: any) => t.Validation<T>,
  strict: boolean,
  cont: (x: T) => G
): G {
  if (strict) {
    const result = decode(arg);
    if (result._tag === "Left") throw new InvalidTypeError(result.left, arg, "Invalid argument");
  }
  return cont(arg);
}

/**
 * Instantiates a REST client for the Marlowe API.
 * @param baseURL An http url pointing to the Marlowe API.
 * @see {@link https://github.com/input-output-hk/marlowe-starter-kit#quick-overview} To get a Marlowe runtime instance up and running.
 */
export function mkRestClient(baseURL: string): RestClient;
/**
 * Instantiates a REST client for the Marlowe API.
 * @param baseURL An http url pointing to the Marlowe API.
 * @param strict Whether to perform runtime checking to provide helpful error messages. May have a slight negative performance impact. Default value is `true`.
 * @see {@link https://github.com/input-output-hk/marlowe-starter-kit#quick-overview} To get a Marlowe runtime instance up and running.
 */
export function mkRestClient(baseURL: string, strict: boolean): RestClient;
export function mkRestClient(baseURL: unknown, strict: unknown = true): RestClient {
  if (!strictDynamicTypeCheck(strict)) {
    throw new InvalidTypeError([], `Invalid type for argument 'strict', expected boolean but got ${strict}`);
  }
  if (!mkRestClientArgumentDynamicTypeCheck(baseURL, strict)) {
    throw new InvalidTypeError([], `Invalid type for argument 'baseURL', expected string but got ${baseURL}`);
  }

  const axiosInstance = axios.create({
    baseURL,
    transformRequest: MarloweJSONCodec.encode,
    transformResponse: MarloweJSONCodec.decode,
  });

  // The runtime version is "cached" here as it is not expected to change during the lifetime of the rest client.
  const runtimeVersion = healthcheck(axiosInstance).then((status) => status.version);

  runtimeVersion.then((x) => {
    if (CompatibleRuntimeVersionGuard.decode(x)._tag === "Left") throw new Error(`Invalid runtime version ${x}`);
  });

  return {
    healthcheck() {
      return healthcheck(axiosInstance);
    },
    version() {
      return healthcheck(axiosInstance).then((status) => status.version);
    },
    getContracts(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Contracts.GetContractsRequestGuard.decode(x),
        strict,
        (request) => {
          const range = request?.range;
          const tags = request?.tags ?? [];
          const partyAddresses = request?.partyAddresses ?? [];
          const partyRoles = request?.partyRoles ?? [];
          return unsafeTaskEither(
            Contracts.getHeadersByRangeViaAxios(axiosInstance)(range)({
              tags,
              partyAddresses,
              partyRoles,
            })
          );
        }
      );
    },
    getContractById(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Contract.GetContractByIdRequest.decode(x),
        strict,
        (request) => {
          return Contract.getContractById(axiosInstance, request.contractId);
        }
      );
    },
    async buildCreateContractTx(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Contracts.BuildCreateContractTxRequestGuard.decode(x),
        strict,
        async (request) => {
          const version = await runtimeVersion;
          // NOTE: Runtime 0.0.5 requires an explicit minUTxODeposit, but 0.0.6 and forward allows that field as optional
          //       and it will calculate the actual minimum required. We use the version of the runtime to determine
          //       if we use a "safe" default that is bigger than needed.
          const minUTxODeposit = request.minimumLovelaceUTxODeposit ?? (version === "0.0.5" ? 3000000 : undefined);
          const postContractsRequest = {
            contract: "contract" in request ? request.contract : request.sourceId,
            version: request.version,
            metadata: request.metadata ?? {},
            tags: request.tags ?? {},
            minUTxODeposit,
            roles: request.roles,
            threadRoleName: request.threadRoleName,
          };
          const addressesAndCollaterals = {
            changeAddress: request.changeAddress,
            usedAddresses: request.usedAddresses ?? [],
            collateralUTxOs: request.collateralUTxOs ?? [],
          };
          return unsafeTaskEither(
            Contracts.postViaAxios(axiosInstance)(postContractsRequest, addressesAndCollaterals, request.stakeAddress)
          );
        }
      );
    },
    createContractSources(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Sources.CreateContractSourcesRequestGuard.decode(x),
        strict,
        (request) => {
          const {
            bundle: { main, bundle },
          } = request;
          return Sources.createContractSources(axiosInstance)(main, bundle);
        }
      );
    },
    getContractSourceById(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Sources.GetContractBySourceIdRequestGuard.decode(x),
        strict,
        (request) => {
          return Sources.getContractSourceById(axiosInstance)(request);
        }
      );
    },
    getContractSourceAdjacency(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Sources.GetContractSourceAdjacencyRequestGuard.decode(x),
        strict,
        (request) => {
          return Sources.getContractSourceAdjacency(axiosInstance)(request);
        }
      );
    },
    getContractSourceClosure(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Sources.GetContractSourceClosureRequestGuard.decode(x),
        strict,
        (request) => {
          return Sources.getContractSourceClosure(axiosInstance)(request);
        }
      );
    },
    getNextStepsForContract(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Next.GetNextStepsForContractRequestGuard.decode(x),
        strict,
        (request) => {
          return Next.getNextStepsForContract(axiosInstance)(request);
        }
      );
    },
    submitContract(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Contract.SubmitContractRequestGuard.decode(x),
        strict,
        (request) => {
          const { contractId, txEnvelope } = request;
          return Contract.submitContract(axiosInstance)(contractId, txEnvelope);
        }
      );
    },
    getTransactionsForContract(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Transactions.GetTransactionsForContractRequestGuard.decode(x),
        strict,
        (request) => {
          const { contractId, range } = request;
          return unsafeTaskEither(Transactions.getHeadersByRangeViaAxios(axiosInstance)(contractId, range));
        }
      );
    },
    submitContractTransaction(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Transaction.SubmitContractTransactionRequestGuard.decode(x),
        strict,
        (request) => {
          const { contractId, transactionId, hexTransactionWitnessSet } = request;
          return unsafeTaskEither(
            Transaction.putViaAxios(axiosInstance)(contractId, transactionId, hexTransactionWitnessSet)
          );
        }
      );
    },
    getContractTransactionById(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Transaction.GetContractTransactionByIdRequestGuard.decode(x),
        strict,
        (request) => {
          const { contractId, txId } = request;
          return unsafeTaskEither(Transaction.getViaAxios(axiosInstance)(contractId, txId));
        }
      );
    },
    withdrawPayouts(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Withdrawals.WithdrawPayoutsRequestGuard.decode(x),
        strict,
        (request) => {
          const { payoutIds, changeAddress } = request;
          return unsafeTaskEither(
            Withdrawals.postViaAxios(axiosInstance)(payoutIds, {
              changeAddress,
              usedAddresses: request.usedAddresses ?? [],
              collateralUTxOs: request.collateralUTxOs ?? [],
            })
          );
        }
      );
    },
    async getWithdrawalById(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Withdrawal.GetWithdrawalByIdRequestGuard.decode(x),
        strict,
        async (request) => {
          const { withdrawalId } = request;
          const { block, ...response } = await unsafeTaskEither(Withdrawal.getViaAxios(axiosInstance)(withdrawalId));
          return { ...response, block: O.toUndefined(block) };
        }
      );
    },
    getWithdrawals(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Withdrawals.GetWithdrawalsRequestGuard.decode(x),
        strict,
        (request) => {
          return unsafeTaskEither(Withdrawals.getHeadersByRangeViaAxios(axiosInstance)(request));
        }
      );
    },
    applyInputsToContract(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Transactions.ApplyInputsToContractRequestGuard.decode(x),
        strict,
        (request) => {
          const { contractId, changeAddress, invalidBefore, invalidHereafter, inputs } = request;
          return unsafeTaskEither(
            Transactions.postViaAxios(axiosInstance)(
              contractId,
              {
                invalidBefore,
                invalidHereafter,
                version: request.version ?? "v1",
                metadata: request.metadata ?? {},
                tags: request.tags ?? {},
                inputs,
              },
              {
                changeAddress,
                usedAddresses: request.usedAddresses ?? [],
                collateralUTxOs: request.collateralUTxOs ?? [],
              }
            )
          );
        }
      );
    },
    submitWithdrawal(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Withdrawal.SubmitWithdrawalRequestGuard.decode(x),
        strict,
        (request) => {
          const { withdrawalId, hexTransactionWitnessSet } = request;
          return unsafeTaskEither(Withdrawal.putViaAxios(axiosInstance)(withdrawalId, hexTransactionWitnessSet));
        }
      );
    },
    async getPayouts(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Payouts.GetPayoutsRequestGuard.decode(x),
        strict,
        async (request) => {
          const { contractIds, roleTokens, range, status } = request;
          return await unsafeTaskEither(
            Payouts.getHeadersByRangeViaAxios(axiosInstance)(range)(contractIds)(roleTokens)(O.fromNullable(status))
          );
        }
      );
    },
    async getPayoutById(request) {
      return withDynamicTypeCheck(
        request,
        (x) => Payout.GetPayoutByIdRequestGuard.decode(x),
        strict,
        async (request) => {
          const { payoutId } = request;
          const result = await unsafeTaskEither(Payout.getViaAxios(axiosInstance)(payoutId));
          return {
            payoutId: result.payoutId,
            contractId: result.contractId,
            ...O.match(
              () => ({}),
              (withdrawalId) => ({ withdrawalId })
            )(result.withdrawalId),
            role: result.role,
            payoutValidatorAddress: result.payoutValidatorAddress,
            status: result.status,
            assets: result.assets,
          };
        }
      );
    },
  };
}

// TODO: Move to Payouts?
/**
 * @hidden
 */
export interface PayoutsAPI {
  getHeadersByRange: Payouts.GETHeadersByRange;
  get: Payout.GET;
}

// TODO: Move to Withdrawals?
/**
 * @hidden
 */
export interface WithdrawalsAPI {
  /**
   * @see {@link https://docs.marlowe.iohk.io/api/get-withdrawals}
   */
  getHeadersByRange: Withdrawals.GETHeadersByRange;
  /**
   * @see {@link https://docs.marlowe.iohk.io/api/create-withdrawals}
   */
  post: Withdrawals.POST;
  withdrawal: {
    /**
     * @see {@link https://docs.marlowe.iohk.io/api/get-withdrawal-by-id}
     */
    get: Withdrawal.GET;
    /**
     * @see {@link https://docs.marlowe.iohk.io/api/create-withdrawal}
     */
    put: Withdrawal.PUT;
  };
}

// TODO: Move to Contracts?
/**
 * @hidden
 */
export interface ContractsAPI {
  /**
   * @see {@link https://docs.marlowe.iohk.io/api/get-contracts}
   */
  getHeadersByRange: Contracts.GETHeadersByRange;
  /**
   * @see {@link https://docs.marlowe.iohk.io/api/create-contracts}
   */
  post: Contracts.BuildCreateContractTxEndpoint;
  contract: {
    /**
     * Get a single contract by id
     * @see {@link https://docs.marlowe.iohk.io/api/get-contracts-by-id}
     */
    get: Contract.GET;
    /**
     * @see {@link https://docs.marlowe.iohk.io/api/create-contracts-by-id}
     */
    put: Contract.PUT;
    /**
     * @see {@link }
     */
    next: Next.GET;
    transactions: {
      /**
       * @see {@link }
       */
      getHeadersByRange: Transactions.GETHeadersByRange;
      /**
       * @see {@link }
       */
      post: Transactions.POST;
      transaction: {
        /**
         * @see {@link }
         */
        get: Transaction.GET;
        /**
         * @see {@link }
         */
        put: Transaction.PUT;
      };
    };
  };
}

/**
 *
 * @description Dependency Injection for the Rest Client API
 * @hidden
 */
export type RestDI = { deprecatedRestAPI: FPTSRestAPI; restClient: RestClient };

/**
 * @hidden
 */
export interface FPTSRestAPI {
  // NOTE: In FP-TS this should probably be T.Task<boolean>, the current implementation returns true or Error.
  /**
   * @see {@link }
   */
  healthcheck: () => TE.TaskEither<Error, RuntimeStatus>;
  payouts: PayoutsAPI;
  withdrawals: WithdrawalsAPI;
  contracts: ContractsAPI;
}

/**
 * Legacy FP-TS version
 * @hidden
 */
export function mkFPTSRestClient(baseURL: string): FPTSRestAPI {
  const axiosInstance = axios.create({
    baseURL: baseURL,
    transformRequest: MarloweJSONCodec.encode,
    transformResponse: MarloweJSONCodec.decode,
  });

  return {
    healthcheck: () => TE.fromTask<RuntimeStatus, Error>(() => healthcheck(axiosInstance)),
    payouts: {
      getHeadersByRange: Payouts.getHeadersByRangeViaAxios(axiosInstance),
      get: Payout.getViaAxios(axiosInstance),
    },
    withdrawals: {
      getHeadersByRange: Withdrawals.getHeadersByRangeViaAxios(axiosInstance),
      post: Withdrawals.postViaAxios(axiosInstance),
      withdrawal: {
        get: Withdrawal.getViaAxios(axiosInstance),
        put: Withdrawal.putViaAxios(axiosInstance),
      },
    },
    contracts: {
      getHeadersByRange: Contracts.getHeadersByRangeViaAxios(axiosInstance),
      post: Contracts.postViaAxios(axiosInstance),
      contract: {
        get: (contractId) => TE.fromTask(() => Contract.getContractById(axiosInstance, contractId)),
        put: Contract.putViaAxios(axiosInstance),
        next: Next.getViaAxios(axiosInstance),
        transactions: {
          getHeadersByRange: Transactions.getHeadersByRangeViaAxios(axiosInstance),
          post: Transactions.postViaAxios(axiosInstance),
          transaction: {
            get: Transaction.getViaAxios(axiosInstance),
            put: Transaction.putViaAxios(axiosInstance),
          },
        },
      },
    },
  };
}
