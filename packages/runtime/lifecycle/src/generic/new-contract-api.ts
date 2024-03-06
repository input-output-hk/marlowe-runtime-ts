import {
  ContractId,
  PolicyId,
  TxId,
  contractIdToTxId,
} from "@marlowe.io/runtime-core";
import {
  ApplyInputsRequest,
  CreateContractRequest,
  createContract,
  applyInputs,
  getInputHistory,
} from "./deprecated-contracts.js";
import { SingleInputTx } from "@marlowe.io/language-core-v1/semantics";
import { Contract, MarloweState } from "@marlowe.io/language-core-v1";
import { RestDI } from "@marlowe.io/runtime-rest-client";
import { WalletDI } from "@marlowe.io/wallet";

/**
 *
 * @description Dependency Injection for the Contract API
 * @hidden
 */
export type ContractsDI = WalletDI & RestDI;

/**
 * TODO comment
 * @category New ContractsAPI
 */
export interface ContractsAPI {
  createContract(
    createContractRequest: CreateContractRequest
  ): Promise<ContractInstanceAPI>;
  loadContract(contractId: ContractId): Promise<ContractInstanceAPI>;
}

export function mkContractsAPI(di: ContractsDI): ContractsAPI {
  return {
    createContract: async (request) => {
      const [contractId, _] = await createContract(di)(request);
      return mkContractInstanceAPI(di, contractId);
    },
    loadContract: async (contractId) => {
      return mkContractInstanceAPI(di, contractId);
    },
  };
}

/**
 * TODO comment
 * @category New ContractsAPI
 */
export interface ContractInstanceAPI {
  contractId: ContractId;
  waitForConfirmation: () => Promise<boolean>;
  getContractDetails: () => Promise<ContractDetails>;
  applyInputs(applyInputsRequest: ApplyInputsRequest): Promise<TxId>;
  // TODO: ApplicableInputs
  /**
   * Get a list of the applied inputs for the contract
   */
  getInputHistory(): Promise<SingleInputTx[]>;
}

function mkContractInstanceAPI(
  di: ContractsDI,
  contractId: ContractId
): ContractInstanceAPI {
  const contractCreationTxId = contractIdToTxId(contractId);
  return {
    contractId,
    waitForConfirmation: async () => {
      return di.wallet.waitConfirmation(contractCreationTxId);
    },
    getContractDetails: async () => {
      return getContractDetails(di, contractId);
    },
    applyInputs: async (request) => {
      return applyInputs(di)(contractId, request);
    },
    getInputHistory: async () => {
      // TODO: We can optimize this by only asking for the new transaction headers
      //       and only asking for contract details of the new transactions.
      return getInputHistory(di)(contractId);
    },
  };
}

async function getContractDetails(
  di: ContractsDI,
  contractId: ContractId
): Promise<ContractDetails> {
  const contractDetails = await di.restClient.getContractById({ contractId });
  if (
    typeof contractDetails.state === "undefined" ||
    typeof contractDetails.currentContract === "undefined"
  ) {
    return { type: "closed" };
  } else {
    return {
      type: "active",
      contractId,
      currentState: contractDetails.state,
      currentContract: contractDetails.currentContract,
      roleTokenMintingPolicyId: contractDetails.roleTokenMintingPolicyId,
    };
  }
}

/**
 * TODO comment
 * @category New ContractsAPI
 */
export type ClosedContract = {
  type: "closed";
};

/**
 * TODO comment
 * @category New ContractsAPI
 */
export type ActiveContract = {
  type: "active";
  contractId: ContractId;
  currentState: MarloweState;
  currentContract: Contract;
  roleTokenMintingPolicyId: PolicyId;
};

/**
 * TODO comment
 * TODO: Fill with all the information we want to expose
 * @category New ContractsAPI
 */
export type ContractDetails = ClosedContract | ActiveContract;

/**
 * TODO comment
 * @category New ContractsAPI
 */
export type GetContractDetailsDI = {
  getContractDetails: (contractId: ContractId) => Promise<ContractDetails>;
};
