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

export interface ApplicableActionsAPI {
  compute(environment?: Environment): Promise<ApplicableAction[]>;
  toInput(
    action: CanNotify | CanDeposit | CanAdvance
  ): Promise<ApplicableInput>;
  toInput(action: CanChoose, chosenNum: ChosenNum): Promise<ApplicableInput>;
  simulate(input: ApplicableInput): Promise<TransactionSuccess>;
  apply(req: ApplyApplicableInputRequest): Promise<TxId>;
  mkFilter(): Promise<ApplicableActionsFilter>;
}

type GetContractDetailsDI = {
  getContractDetails: () => Promise<ContractDetails>;
};

type ContractIdDI = {
  contractId: ContractId;
};

function mkApplicableActionsAPI(
  di: RestDI & WalletDI & GetContractDetailsDI & ContractIdDI
): ApplicableActionsAPI {
  // TODO: Revisit the DI for this function
  const standaloneAPI = Applicable.mkApplicableActionsAPI(di);
  const getActiveContractDetails = () =>
    di.getContractDetails().then((details) => {
      // TODO: improve error type
      if (details.type !== "active") {
        throw new Error("Contract is not active");
      }
      return details;
    });
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
    const contractDetails = await getActiveContractDetails();
    if (action.actionType === "Choice") {
      return standaloneAPI.getInput(contractDetails, action, chosenNum!);
    } else {
      return standaloneAPI.getInput(contractDetails, action);
    }
  }

  return {
    compute: (environment) =>
      di
        .getContractDetails()
        .then((details) =>
          standaloneAPI.getApplicableActions(details, environment)
        ),
    toInput,
    // NOTE: The original ApplicableActionsAPI does not use promises and assumes that the contract details were
    //       the same as the ones used to compute and toInput. This is not the case here as we are fetching the contract
    //       details each time. We might want to rethink the flow of this API.
    simulate: (input) =>
      getActiveContractDetails().then((details) =>
        standaloneAPI.simulateInput(details, input)
      ),
    apply: (req) => standaloneAPI.applyInput(di.contractId, req),
    mkFilter: () =>
      getActiveContractDetails().then((details) =>
        standaloneAPI.mkFilter(details)
      ),
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
  applicableActions: ApplicableActionsAPI;
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
      return getContractDetails(di)(contractId);
    },
    applicableActions: mkApplicableActionsAPI({
      ...di,
      contractId,
      getContractDetails: () => getContractDetails(di)(contractId),
    }),
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
