import { RuntimeLifecycle } from "../api.js";
import { WalletAPI } from "@marlowe.io/wallet/api";

import { FPTSRestAPI, RestClient } from "@marlowe.io/runtime-rest-client";

import { mkPayoutLifecycle } from "./payouts.js";
import { mkContractLifecycle } from "./deprecated-contracts.js";
import { mkApplicableActionsAPI } from "./applicable-actions.js";
import * as NewContract from "./new-contract-api.js";

export function mkRuntimeLifecycle(
  deprecatedRestAPI: FPTSRestAPI,
  restClient: RestClient,
  wallet: WalletAPI
): RuntimeLifecycle {
  const deprecatedContractAPI = mkContractLifecycle(
    wallet,
    deprecatedRestAPI,
    restClient
  );
  return {
    wallet: wallet,
    restClient,
    deprecatedContractAPI,
    newContractAPI: NewContract.mkContractsAPI({ wallet, restClient }),
    payouts: mkPayoutLifecycle(wallet, deprecatedRestAPI, restClient),
    applicableActions: mkApplicableActionsAPI(
      restClient,
      wallet,
      deprecatedContractAPI.applyInputs
    ),
  };
}
