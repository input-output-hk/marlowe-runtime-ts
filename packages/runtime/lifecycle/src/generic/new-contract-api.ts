import { ContractId, PolicyId, TxId, contractIdToTxId } from "@marlowe.io/runtime-core";
import { CreateContractRequest, createContract, getInputHistory } from "./contracts.js";
import { SingleInputTx, TransactionSuccess } from "@marlowe.io/language-core-v1/semantics";
import { ChosenNum, Contract, Environment, MarloweState } from "@marlowe.io/language-core-v1";
import { RestDI } from "@marlowe.io/runtime-rest-client";
import { WalletDI } from "@marlowe.io/wallet";
import {
  ApplicableAction,
  ApplicableInput,
  ApplyApplicableInputRequest,
  CanAdvance,
  CanChoose,
  CanDeposit,
  CanNotify,
  ChainTipDI,
  GetContinuationDI,
} from "./applicable-actions.js";
import * as Applicable from "./applicable-actions.js";

/**
 *
 * @description Dependency Injection for the Contract API
 * @hidden
 */
export type ContractsDI = WalletDI & RestDI & GetContinuationDI & ChainTipDI;

/**
 * This Interface provides capabilities for runnning a Contract over Cardano.
 * @category New ContractsAPI
 */
export interface ContractsAPI {
  /**
   * Submit to the Cardano Ledger, the Transaction(Tx) that will create the Marlowe Contract passed in the request.
   * It doesn't wait for the transaction to be confirmed on the Cardano blockchain.
   * @param createContractRequest Request parameters for creating a Marlowe Contract on Cardano
   * @returns A contract instance API that can be used to interact with the contract newly created
   */
  create(request: CreateContractRequest): Promise<ContractInstanceAPI>;

  /**
   * Load a contract instance API for a given contract id.
   * @param id The contract id of the contract instance
   * @returns A contract instance API that can be used to interact with the contract
   */
  load(id: ContractId): Promise<ContractInstanceAPI>;
}

/**
 * This function creates a ContractsAPI instance.
 * @param di Dependency Injection for the Contract API
 * @returns ContractsAPI instance
 */
export function mkContractsAPI(di: ContractsDI): ContractsAPI {
  // The ContractInstance API is stateful as it has some cache, so whenever
  // possible we want to reuse the same instance of the API for the same contractId
  const apis = new Map<ContractId, ContractInstanceAPI>();

  return {
    create: async (request) => {
      const [contractId, _] = await createContract(di)(request);
      apis.set(contractId, mkContractInstanceAPI(di, contractId));
      return apis.get(contractId)!;
    },
    load: async (contractId) => {
      if (apis.has(contractId)) {
        return apis.get(contractId)!;
      } else {
        return mkContractInstanceAPI(di, contractId);
      }
    },
  };
}

/**
 * This Interface provides capabilities for evaluating the applicable actions for a contract instance.
 * An applicable action is an action that can be applied to a contract instance in a given environment.
 * @category New ContractsAPI
 **/
export interface ApplicableActionsAPI {
  /**
   * A list of all the applicable actions for the contract instance regarless of the role of the wallet
   * @returns A list of applicable actions
   */
  actions: ApplicableAction[];
  /**
   * A list of all the applicable actions for the contract instance that the wallet can perform
   * @returns A list of applicable actions
   */
  myActions: ApplicableAction[];
  /**
   * Convert an applicable action to an applicable input
   * @param action An applicable action
   * @returns An applicable input
   */
  toInput(action: CanNotify | CanDeposit | CanAdvance): Promise<ApplicableInput>;
  /**
   * Convert an applicable action to an applicable input
   * @param action An applicable action
   * @param chosenNum The number chosen in the choice action
   * @returns An applicable input
   */
  toInput(action: CanChoose, chosenNum: ChosenNum): Promise<ApplicableInput>;
  /**
   * Simulates the result of applying an input to the contract instance
   * @param input An applicable input
   * @returns The result of applying the input
   */
  simulate(input: ApplicableInput): TransactionSuccess;
  /**
   * Apply an input to the contract instance
   * @param req Request parameters for applying an input to the contract instance
   * @returns The transaction id of the transaction that applied the input
   */
  apply(req: ApplyApplicableInputRequest): Promise<TxId>;
}

function mkApplicableActionsAPI(
  di: RestDI & WalletDI & GetContinuationDI & ChainTipDI,
  actions: ApplicableAction[],
  myActions: ApplicableAction[],
  contractDetails: ContractDetails,
  contractId: ContractId
): ApplicableActionsAPI {
  const getActiveContractDetails = () => {
    if (contractDetails.type !== "active") {
      throw new Error("Contract is not active");
    }
    return contractDetails;
  };

  const standaloneAPI = Applicable.mkApplicableActionsAPI(di);

  async function toInput(action: CanNotify | CanDeposit | CanAdvance): Promise<ApplicableInput>;
  async function toInput(action: CanChoose, chosenNum: ChosenNum): Promise<ApplicableInput>;
  async function toInput(action: ApplicableAction, chosenNum?: ChosenNum): Promise<ApplicableInput> {
    const activeContractDetails = getActiveContractDetails();
    if (action.type === "Choice") {
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
 * Request parameters for evaluating the applicable actions for a contract instance.
 * @category New ContractsAPI
 */
export type EvaluateApplicableActionsRequest = {
  /*
   * Applicable actions are evaluated in the context of an environment (time interval of execution on the Cardano Ledger).
   */
  environment?: Environment;
};

/**
 * This Interface provides capabilities for interacting with a Contract Instance.
 * A Contract Instance is a contract that has been created on the Cardano blockchain.
 * @category New ContractsAPI
 */
export interface ContractInstanceAPI {
  /**
   * The contract Id of the contract instance
   */
  id: ContractId;
  /**
   * Wait for the transaction that created the contract to be confirmed on the Cardano blockchain.
   * @returns A boolean value indicating whether the transaction has been confirmed or not.
   */
  waitForConfirmation: () => Promise<boolean>;
  /**
   * Get the details of the contract instance
   * @returns The details of the contract instance
   */
  getDetails: () => Promise<ContractDetails>;
  /**
   * Check if the contract instance is active
   * @returns A boolean value indicating whether the contract instance is active or not
   */
  isActive: () => Promise<boolean>;
  /**
   * Check if the contract instance is closed
   * @returns A boolean value indicating whether the contract instance is closed or not
   */
  isClosed: () => Promise<boolean>;
  /**
   * Apply inputs to the contract instance
   * @param applyInputsRequest Request parameters for applying inputs to the contract instance
   * @returns The transaction id of the transaction that applied the inputs
   */
  applyInput(request: ApplyApplicableInputRequest): Promise<TxId>;
  /**
   * Compute the applicable actions for the contract instance
   * @param request Request parameters for computing the applicable actions
   * @returns ApplicableActionsAPI instance
   */
  evaluateApplicableActions(request?: EvaluateApplicableActionsRequest): Promise<ApplicableActionsAPI>;
  /**
   * Get a list of the applied inputs for the contract
   */
  getInputHistory(): Promise<SingleInputTx[]>;
}

function mkContractInstanceAPI(di: ContractsDI & GetContinuationDI & ChainTipDI, id: ContractId): ContractInstanceAPI {
  const contractCreationTxId = contractIdToTxId(id);
  const applicableActionsAPI = Applicable.mkApplicableActionsAPI(di);
  return {
    id,
    waitForConfirmation: async () => {
      try {
        // Todo : This is a temporary solution. We need to implement a better way to get the last transaction.
        // Improve Error handling
        const txs = await di.restClient.getTransactionsForContract({ contractId: id }).then((res) => res.transactions);
        if (txs.length === 0) {
          return di.wallet.waitConfirmation(contractCreationTxId);
        } else {
          return di.wallet.waitConfirmation(txs[txs.length - 1].transactionId);
        }
      } catch (e) {
        // triggered when the contract is not found yet
        return di.wallet.waitConfirmation(contractCreationTxId);
      }
    },
    getDetails: async () => {
      return getContractDetails(di)(id);
    },
    evaluateApplicableActions: async (req = {}) => {
      const contractDetails = await getContractDetails(di)(id);
      const actions = await applicableActionsAPI.getApplicableActions(contractDetails, req.environment);
      let myActions = [] as ApplicableAction[];
      if (contractDetails.type === "active") {
        const myActionsFilter = await applicableActionsAPI.mkFilter(contractDetails);
        myActions = actions.filter(myActionsFilter);
      }

      return mkApplicableActionsAPI(di, actions, myActions, contractDetails, id);
    },
    applyInput: async (request) => {
      return applicableActionsAPI.applyInput(id, request);
    },
    isActive: async () => {
      return (await getContractDetails(di)(id)).type === "active";
    },
    isClosed: async () => {
      return (await getContractDetails(di)(id)).type === "closed";
    },
    getInputHistory: async () => {
      // TODO: We can optimize this by only asking for the new transaction headers
      //       and only asking for contract details of the new transactions.
      return getInputHistory(di)(id);
    },
  };
}

function getContractDetails(di: ContractsDI) {
  return async function (contractId: ContractId): Promise<ContractDetails> {
    const contractDetails = await di.restClient.getContractById({ contractId });
    if (typeof contractDetails.state === "undefined" || typeof contractDetails.currentContract === "undefined") {
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
 * A closed contract is a contract that has been closed and is no longer active.
 * It is still stored in the Cardano ledger, but it cannot receive inputs or advance its state anymore.
 * @category New ContractsAPI
 */
export type ClosedContract = {
  type: "closed";
};

/**
 * An active contract is a contract appended to a Cardano ledger that is not closed.
 * It can receive inputs and advance its state.
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
 * Represents the details of a contract, either active or closed.
 * @category New ContractsAPI
 */
export type ContractDetails = ClosedContract | ActiveContract;
