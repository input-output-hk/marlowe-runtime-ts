import { WalletAPI } from "@marlowe.io/wallet/api";
import { FPTSRestAPI, RestClient } from "@marlowe.io/runtime-rest-client";
import { Contract } from "@marlowe.io/language-core-v1";
import { ContractSourceId } from "@marlowe.io/marlowe-object";

import { RuntimeLifecycle } from "../api.js";
import { mkPayoutLifecycle } from "./payouts.js";
import { mkContractLifecycle } from "./contracts.js";
import { mkApplicableActionsAPI } from "./applicable-actions.js";
import * as NewContract from "./new-contract-api.js";

export function mkRuntimeLifecycle(
  deprecatedRestAPI: FPTSRestAPI,
  restClient: RestClient,
  wallet: WalletAPI
): RuntimeLifecycle {
  const contracts = mkContractLifecycle(wallet, deprecatedRestAPI, restClient);
  // We cache the contract sources when the API is asking for continuations
  const sources = new Map<ContractSourceId, Contract>();

  const di = {
    wallet,
    restClient,
    getContractContinuation: async (contractSourceId: ContractSourceId) => {
      if (sources.has(contractSourceId)) {
        return sources.get(contractSourceId)!;
      } else {
        const contract = await restClient.getContractSourceById({
          contractSourceId,
        });
        sources.set(contractSourceId, contract);
        return contract;
      }
    },
    getRuntimeTip: async () => {
      const status = await restClient.healthcheck();
      return new Date(status.tips.runtimeChain.slotTimeUTC);
    },
  };
  return {
    wallet: wallet,
    restClient,
    contracts,
    newContractAPI: NewContract.mkContractsAPI(di),
    payouts: mkPayoutLifecycle(wallet, deprecatedRestAPI, restClient),
    applicableActions: mkApplicableActionsAPI(di),
  };
}
