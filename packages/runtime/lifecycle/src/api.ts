import { WalletAPI, WalletDI } from "@marlowe.io/wallet/api";
import { AssetId, ContractId, PayoutAvailable, PayoutId, PayoutWithdrawn } from "@marlowe.io/runtime-core";
import { DeprecatedRestDI, RestClient, RestDI } from "@marlowe.io/runtime-rest-client";

import {
  ApplicableActionsAPI,
  ApplicableAction,
  ApplicableInput,
  ApplicableActionsFilter,
  ApplicableActionsWithDetailsFilter,
  ApplyApplicableInputRequest,
  CanAdvance,
  CanChoose,
  CanDeposit,
  CanNotify,
} from "./generic/applicable-actions.js";
import { ActiveContract, ClosedContract, ContractDetails, ContractInstanceAPI } from "./generic/new-contract-api.js";
import {
  ApplyInputsRequest,
  ContractsAPI,
  CreateContractRequest,
  CreateContractRequestBase,
  CreateContractRequestFromBundle,
  CreateContractRequestFromContract,
} from "./generic/contracts.js";
import {
  ContractsAPI as NewContractsAPI,
  ApplicableActionsAPI as NewApplicableActionsAPI,
  EvaluateApplicableActionsRequest,
} from "./generic/new-contract-api.js";
import * as NewContract from "./generic/new-contract-api.js";

export {
  ApplicableActionsAPI,
  ApplicableAction,
  ApplicableInput,
  ApplicableActionsFilter,
  ApplicableActionsWithDetailsFilter,
  ApplyApplicableInputRequest,
  CanAdvance,
  CanChoose,
  CanDeposit,
  CanNotify,
  ActiveContract,
  ClosedContract,
  ContractDetails,
  ContractInstanceAPI,
  CreateContractRequestBase,
  ContractsAPI,
  ApplyInputsRequest,
  CreateContractRequest,
  NewContractsAPI,
  NewApplicableActionsAPI,
  EvaluateApplicableActionsRequest as ComputeApplicableActionsRequest,
  CreateContractRequestFromContract,
  CreateContractRequestFromBundle,
};

/**
 * This is the main entry point of the @marlowe.io/runtime-lifecycle package. It provides a set of APIs to
 * interact with the Marlowe Runtime.
 *
 * This interface can be created from {@link @marlowe.io/runtime-lifecycle!index | a wallet API instance } or if you are in the browser
 * from a {@link @marlowe.io/runtime-lifecycle!browser | wallet name}.
 * @category RuntimeLifecycle
 */
export interface RuntimeLifecycle {
  /**
   * The wallet API as defined in the {@link @marlowe.io/wallet! } package. It is re-exported here for convenience.
   */
  wallet: WalletAPI;
  /**
   * Access to the low-level REST API as defined in the {@link @marlowe.io/runtime-rest-client! } package. It is re-exported here for convenience.
   */
  restClient: RestClient;

  /**
   * The new contract API is a high level API that lets you create and interact with Marlowe contracts.
   */
  newContractAPI: NewContract.ContractsAPI;

  /**
   * The contracts API is a high level API that lets you create and interact with Marlowe contracts.
   *  @deprecated Use {@link RuntimeLifecycle.newContractAPI} instead.
   */
  contracts: ContractsAPI;
  payouts: PayoutsAPI;
  applicableActions: ApplicableActionsAPI;
}

/**
 * @hidden
 */
export type PayoutsDI = WalletDI & RestDI & DeprecatedRestDI;

/**
 * @category PayoutsAPI
 */
export interface PayoutsAPI {
  /**
   * Provide All the availaible payouts for the connected Wallet
   * @param filters provide filtering capabilities on the available payouts returned
   * @throws DecodingError
   */
  available(filters?: Filters): Promise<PayoutAvailable[]>;

  // TODO : Withdraw should not `waitConfirmation` behind the scene and it should return a `TxId` (https://github.com/input-output-hk/marlowe-ts-sdk/issues/170)
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
 * @category PayoutsAPI
 */
export const onlyByContractIds = (contractIds: ContractId[]) =>
  ({
    byContractIds: contractIds,
    byMyRoleTokens: (myRoles) => myRoles,
  }) as Filters;

/**
 * Provide filtering capabilities on the payouts returned
 * @param byContractIds filters the payouts by contract Ids
 * @param byMyRoleTokens filters the payouts by role tokens owned in the connected wallet
 * @throws DecodingError
 * @category PayoutsAPI
 */
export type Filters = {
  byContractIds: ContractId[];
  byMyRoleTokens: (myRolesOnWallet: AssetId[]) => AssetId[];
};
