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
import {
  SingleInputTx,
  TransactionSuccess,
} from "@marlowe.io/language-core-v1/semantics";
import {
  ChosenNum,
  Contract,
  Environment,
  MarloweState,
} from "@marlowe.io/language-core-v1";
import { RestClient, RestDI } from "@marlowe.io/runtime-rest-client";
import { WalletAPI, WalletDI } from "@marlowe.io/wallet";
import {
  ApplicableAction,
  ApplicableActionsFilter,
  ApplicableInput,
  ApplyApplicableInputRequest,
  ApplyInputDI,
  CanAdvance,
  CanChoose,
  CanDeposit,
  CanNotify,
} from "./applicable-actions.js";
import * as Applicable from "./applicable-actions.js";

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
  // The ContractInstance API is stateful as it has some cache, so whenever
  // possible we want to reuse the same instance of the API for the same contractId
  const apis = new Map<ContractId, ContractInstanceAPI>();
  return {
    createContract: async (request) => {
      const [contractId, _] = await createContract(di)(request);
      apis.set(contractId, mkContractInstanceAPI(di, contractId));
      return apis.get(contractId)!;
    },
    loadContract: async (contractId) => {
      if (apis.has(contractId)) {
        return apis.get(contractId)!;
      } else {
        return mkContractInstanceAPI(di, contractId);
      }
    },
  };
}

export interface ApplicableActionsAPI {
  actions: ApplicableAction[];
  myActions: ApplicableAction[];
  toInput(
    action: CanNotify | CanDeposit | CanAdvance
  ): Promise<ApplicableInput>;
  toInput(action: CanChoose, chosenNum: ChosenNum): Promise<ApplicableInput>;
  simulate(input: ApplicableInput): TransactionSuccess;
  apply(req: ApplyApplicableInputRequest): Promise<TxId>;
}

function mkApplicableActionsAPI(
  di: RestDI & WalletDI,
  actions: ApplicableAction[],
  myActions: ApplicableAction[],
  contractDetails: ContractDetails,
  contractId: ContractId
): ApplicableActionsAPI {
  // TODO: Revisit the DI for this function
  const standaloneAPI = Applicable.mkApplicableActionsAPI(di);
  const getActiveContractDetails = () => {
    if (contractDetails.type !== "active") {
      throw new Error("Contract is not active");
    }
    return contractDetails;
  };

  async function toInput(
    action: CanNotify | CanDeposit | CanAdvance
  ): Promise<ApplicableInput>;
  async function toInput(
    action: CanChoose,
    chosenNum: ChosenNum
  ): Promise<ApplicableInput>;
  async function toInput(
    action: ApplicableAction,
    chosenNum?: ChosenNum
  ): Promise<ApplicableInput> {
    const activeContractDetails = getActiveContractDetails();
    if (action.actionType === "Choice") {
      return standaloneAPI.getInput(activeContractDetails, action, chosenNum!);
    } else {
      return standaloneAPI.getInput(activeContractDetails, action);
    }
  }

  return {
    actions,
    myActions,
    toInput,
    simulate: (input) => {
      const activeContractDetails = getActiveContractDetails();
      return standaloneAPI.simulateInput(activeContractDetails, input);
    },
    apply: (req) => standaloneAPI.applyInput(contractId, req),
  };
}

/**
 * TODO comment
 * @category New ContractsAPI
 */
type ComputeApplicableActionsRequest = {
  environment?: Environment;
  contractDetails?: ContractDetails;
};

/**
 * TODO comment
 * @category New ContractsAPI
 */
export interface ContractInstanceAPI {
  contractId: ContractId;
  waitForConfirmation: () => Promise<boolean>;
  getContractDetails: () => Promise<ContractDetails>;
  applyInputs(applyInputsRequest: ApplyInputsRequest): Promise<TxId>;
  computeApplicableActions(
    request?: ComputeApplicableActionsRequest
  ): Promise<ApplicableActionsAPI>;
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
  const applicableActionsAPI = Applicable.mkApplicableActionsAPI(di);
  return {
    contractId,
    waitForConfirmation: async () => {
      return di.wallet.waitConfirmation(contractCreationTxId);
    },
    getContractDetails: async () => {
      return getContractDetails(di)(contractId);
    },
    computeApplicableActions: async (req = {}) => {
      const contractDetails =
        req.contractDetails ?? (await getContractDetails(di)(contractId));
      const actions = await applicableActionsAPI.getApplicableActions(
        contractDetails,
        req.environment
      );
      let myActions = [] as ApplicableAction[];
      if (contractDetails.type === "active") {
        const myActionsFilter =
          await applicableActionsAPI.mkFilter(contractDetails);
        myActions = actions.filter(myActionsFilter);
      }

      return mkApplicableActionsAPI(
        di,
        actions,
        myActions,
        contractDetails,
        contractId
      );
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

function getContractDetails(di: ContractsDI) {
  return async function (contractId: ContractId): Promise<ContractDetails> {
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
  };
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
