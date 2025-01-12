/**
 * ```ts
 * import * as C from "@marlowe.io/runtime-rest-client/contract";
 *```
 * This package contains all the implementation and details related to
 * endpoints under the URI `/contracts/...` :
 *  - {@link index.RestClient#buildCreateContractTx | Build Create Contract Tx }
 *  - {@link index.RestClient#getContracts | Get contracts }
 *  - {@link index.RestClient#getContractById | Get Contract By Id }

 * @packageDocumentation
 */

export { ContractHeader } from "./header.js";
export { ContractDetails } from "./details.js";
export {
  useMintedRoles,
  mintRole,
  openRole,
  ClosedRole,
  OpenRole,
  Openness,
  UsePolicyWithClosedRoleTokens,
  UsePolicyWithOpenRoleTokens,
  MintRolesTokens,
  TokenMetadataFile,
  TokenMetadata,
  Recipient,
  TokenQuantity,
  RoleTokenConfiguration,
  RoleTokenConfigurations,
  RolesConfiguration,
} from "./rolesConfigurations.js";

export {
  GetContractsResponse,
  GetContractsRequest,
  ContractOrSourceId,
  BuildCreateContractTxRequest,
  BuildCreateContractTxRequestWithContract,
  BuildCreateContractTxRequestWithSourceId,
  BuildCreateContractTxRequestOptions,
  BuildCreateContractTxResponse,
} from "./endpoints/collection.js";

export { SubmitContractRequest } from "./endpoints/singleton.js";
export { TxHeader } from "./transaction/header.js";

export {
  GetContractTransactionByIdRequest,
  SubmitContractTransactionRequest,
} from "./transaction/endpoints/singleton.js";

export {
  GetTransactionsForContractResponse,
  ApplyInputsToContractRequest,
  ApplyInputsToContractResponsePayload,
  ApplyInputsToContractResponse,
  GetTransactionsForContractRequest,
} from "./transaction/endpoints/collection.js";

export {
  CreateContractSourcesRequest,
  CreateContractSourcesResponse,
  GetContractSourceAdjacencyResponse,
  GetContractSourceClosureResponse,
  GetContractSourceAdjacencyRequest,
  GetContractBySourceIdRequest,
  GetContractSourceClosureRequest,
} from "./endpoints/sources.js";

export { TransactionDetails } from "./transaction/details.js";
export { TxStatus } from "./transaction/status.js";
export { GetNextStepsForContractRequest } from "./next/endpoint.js";
export { TransactionTextEnvelope } from "./transaction/endpoints/collection.js";
