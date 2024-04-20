import { ApplyInputsRequest, ContractsAPI, applyInputs } from "./contracts.js";

import { Monoid } from "fp-ts/lib/Monoid.js";
import * as R from "fp-ts/lib/Record.js";

import {
  MarloweState,
  Party,
  Contract,
  Deposit,
  Choice,
  Input,
  ChosenNum,
  Environment,
  Timeout,
  getNextTimeout,
  datetoTimeout,
  Case,
  Action,
  Notify,
  InputContent,
  RoleName,
  Token,
  Bound,
  BuiltinByteString,
} from "@marlowe.io/language-core-v1";
import {
  computeTransaction,
  evalObservation,
  evalValue,
  inBounds,
  reduceContractUntilQuiescent,
  TransactionSuccess,
} from "@marlowe.io/language-core-v1/semantics";
import { AddressBech32, ContractId, Metadata, PolicyId, Tags, TxId } from "@marlowe.io/runtime-core";
import { RestDI } from "@marlowe.io/runtime-rest-client";
import { WalletAPI, WalletDI } from "@marlowe.io/wallet";
import * as Big from "@marlowe.io/adapter/bigint";
import { ContractSourceId } from "@marlowe.io/marlowe-object";
import { posixTimeToIso8601 } from "@marlowe.io/adapter/time";
import { ActiveContract, ContractDetails } from "./new-contract-api.js";

/**
 * @experimental
 * @category ApplicableActionsAPI
 */
export interface ApplicableActionsAPI {
  /**
   * Get what actions can be applied to a contract in a given environment.
   * @param contractId The id of a Marlowe contract
   * @param environment An optional interval with the time bounds to apply the actions. If none is provided
   *                    the environment is computed using the runtime tip as a lower bound and the next timeout
   *                    as an upper bound.
   * @returns An object with an array of {@link ApplicableAction | applicable actions} and the {@link ContractDetails | contract details}
   */
  getApplicableActions(contractDetails: ContractDetails, environment?: Environment): Promise<ApplicableAction[]>;

  /**
   * Converts an {@link ApplicableAction} into an {@link ApplicableInput}.
   *
   * This function has two {@link https://www.tutorialsteacher.com/typescript/function-overloading | overloads}. This
   * one can be used with {@link @marlowe.io/language-core-v1!index.Notify},
   * {@link @marlowe.io/language-core-v1!index.Deposit} actions, or to Advance a timed out
   * contract, none of which require further information.
   */
  getInput(contractDetails: ActiveContract, action: CanNotify | CanDeposit | CanAdvance): Promise<ApplicableInput>;
  /**
   * Converts an {@link ApplicableAction} into an {@link ApplicableInput}.
   *
   * This function has two {@link https://www.tutorialsteacher.com/typescript/function-overloading | overloads}. This
   * one can be used with the Choose action, which requires the chosen number.
   */
  getInput(contractDetails: ActiveContract, action: CanChoose, chosenNum: ChosenNum): Promise<ApplicableInput>;

  /**
   * Applies an {@link ApplicableInput} to a contract.
   * @returns The transaction id of the applied input.
   */
  applyInput(contractId: ContractId, request: ApplyApplicableInputRequest): Promise<TxId>;
  /**
   * Simulates the result of applying an {@link ApplicableInput}. The input should be obtained by
   * {@link getApplicableActions | computing the applicable actions} and then {@link getInput | converting them into an input}.
   * @returns If the input was obtained by the described flow, it is guaranteed to return a {@link TransactionSuccess} with
   *          the payments, state, warnings and new continuation.
   */
  simulateInput(contractDetails: ActiveContract, input: ApplicableInput): TransactionSuccess;

  /**
   * Creates a filter function for the {@link ApplicableAction | applicable actions} of the wallet owner.
   * The wallet is configured when we instantiate the {@link RuntimeLifecycle}. This function returns a new
   * filter function when called multiple times. This is useful to update the filter to check for new Role tokens
   * available in the wallet.
   *
   * The function has two {@link https://www.tutorialsteacher.com/typescript/function-overloading | overloads}. This
   * one is appied with the contract details and it is useful when filtering the actions of a specific contract.
   */
  mkFilter(contractDetails: ActiveContract): Promise<ApplicableActionsFilter>;
  /**
   * Creates a filter function for the {@link ApplicableAction | applicable actions} of the wallet owner.
   * The wallet is configured when we instantiate the {@link RuntimeLifecycle}. This function returns a new
   * filter function when called multiple times. This is useful to update the filter to check for new Role tokens
   * available in the wallet.
   *
   * The function has two {@link https://www.tutorialsteacher.com/typescript/function-overloading | overloads}. This
   * one does not receive any argument and it is useful when filtering the actions of multiple contracts.
   * Notice that the {@link ApplicableActionsWithDetailsFilter | filter function} returned by this overload will require the contract details to be passed as
   * a second argument.
   */
  mkFilter(): Promise<ApplicableActionsWithDetailsFilter>;
}

/**
 *
 * @category ApplicableActionsAPI
 */
export interface ApplyApplicableInputRequest {
  input: ApplicableInput;
  tags?: Tags;
  metadata?: Metadata;
}

/**
 * @hidden
 */
export function mkApplicableActionsAPI(di: RestDI & WalletDI & GetContinuationDI & ChainTipDI): ApplicableActionsAPI {
  async function mkFilter(): Promise<ApplicableActionsWithDetailsFilter>;
  async function mkFilter(contractDetails: ActiveContract): Promise<ApplicableActionsFilter>;
  async function mkFilter(
    contractDetails?: ActiveContract
  ): Promise<ApplicableActionsFilter | ApplicableActionsWithDetailsFilter> {
    const curriedFilter = await mkApplicableActionsFilter(di.wallet);
    if (contractDetails) {
      return (action: ApplicableAction) => curriedFilter(action, contractDetails);
    } else {
      return curriedFilter;
    }
  }

  return {
    getInput: getApplicableInput(di),
    simulateInput: simulateApplicableInput,
    getApplicableActions: getApplicableActions(di),
    applyInput: applyInput(applyInputs(di)),
    mkFilter,
  };
}

export type ApplyInputDI = (contractId: ContractId, request: ApplyInputsRequest) => Promise<TxId>;

function applyInput(doApply: ApplyInputDI) {
  return async function (contractId: ContractId, request: ApplyApplicableInputRequest): Promise<TxId> {
    return doApply(contractId, {
      inputs: request.input.inputs,
      tags: request.tags,
      metadata: request.metadata,
      invalidBefore: posixTimeToIso8601(request.input.environment.timeInterval.from),
      // NOTE: This is commented out because the end time of the interval might be
      //       way into the future and the time to slot conversion is undefined if the
      //       end time passes a certain threshold.
      //       We currently don't have the network parameters to do the conversion ourselves
      //       so we leave to the runtime to calculate an adecuate max slot.
      //       This might cause some issues if the contract relies on the TimeIntervalEnd value
      //       as the result of simulating and applying the input might differ.
      // invalidHereafter: posixTimeToIso8601(
      //   request.input.environment.timeInterval.to
      // ),
    });
  };
}

type ActionApplicant = Party | "anybody";

/**
 * @category ApplicableActionsAPI
 */
export interface ApplicableInput {
  /**
   * What inputs needs to be provided to apply the action
   */
  inputs: Input[];

  /**
   * What is the environment to apply the inputs
   */
  environment: Environment;
}

/**
 * This data structure indicates that the contract can be notified.
 * @category ApplicableActionsAPI
 */
export interface CanNotify {
  /**
   * Discriminator field, used to differentiate the action type.
   */
  type: "Notify";
  /**
   * If the When's case is merkleized, this is the hash of the merkleized continuation.
   */
  merkleizedContinuationHash?: BuiltinByteString;
  /**
   * The action can be applied in this environment.
   */
  environment: Environment;
}

/**
 * This data structure indicates that the contract can receive a deposit.
 * @category ApplicableActionsAPI
 */
export interface CanDeposit {
  /**
   * Discriminator field, used to differentiate the action type.
   */
  type: "Deposit";
  /**
   * If the When's case is merkleized, this is the hash of the merkleized continuation.
   */
  merkleizedContinuationHash?: BuiltinByteString;
  /**
   * The deposit action that can be applied.
   */
  deposit: Deposit;
  /**
   * The action can be applied in this environment.
   */
  environment: Environment;
}

/**
 * This data structure indicates that the contract can receive a Choice action.
 * @category ApplicableActionsAPI
 */
export interface CanChoose {
  /**
   * Discriminator field, used to differentiate the action type.
   */
  type: "Choice";
  /**
   * If the When's case is merkleized, this is the hash of the merkleized continuation.
   */
  merkleizedContinuationHash?: BuiltinByteString;
  /**
   * The choice action that can be applied.
   */
  choice: Choice;
  /**
   * The action can be applied in this environment.
   */
  environment: Environment;
}

/**
 * This data structure indicates that the contract is timed out and can be advanced to it's continuation.
 * If the timeout continuation is a Close contract, then this is the only way to close it. If the continuation
 * has a When with some actions, then the contract can either be advanced to the next When, or one of the
 * next actions can be applied.
 * @category ApplicableActionsAPI
 */
export interface CanAdvance {
  type: "Advance";
  environment: Environment;
}

/**
 * Represents what actions can be applied to a contract in a given environment.
 * @category ApplicableActionsAPI
 */
export type ApplicableAction = CanNotify | CanDeposit | CanChoose | CanAdvance;

/**
 * @hidden
 */
export function getApplicableInput(di: GetContinuationDI) {
  async function doMakeApplicableInput(
    contractDetails: ActiveContract,
    action: CanNotify | CanDeposit | CanAdvance
  ): Promise<ApplicableInput>;
  async function doMakeApplicableInput(
    contractDetails: ActiveContract,
    action: CanChoose,
    chosenNum: ChosenNum
  ): Promise<ApplicableInput>;
  async function doMakeApplicableInput(
    contractDetails: ActiveContract,
    action: ApplicableAction,
    chosenNum?: ChosenNum
  ): Promise<ApplicableInput>;
  async function doMakeApplicableInput(
    contractDetails: ActiveContract,
    action: ApplicableAction,
    chosenNum?: ChosenNum
  ): Promise<ApplicableInput> {
    async function decorateInput(
      content: InputContent,
      merkleizedContinuationHash?: BuiltinByteString
    ): Promise<Input> {
      if (merkleizedContinuationHash) {
        const aCaseContinuation = await di.getContractContinuation(merkleizedContinuationHash);
        const merkleizedHashAndContinuation = {
          continuation_hash: merkleizedContinuationHash,
          merkleized_continuation: aCaseContinuation,
        };
        // MerkleizedNotify are serialized as the plain merkle object
        if (content === "input_notify") {
          return merkleizedHashAndContinuation;
        } else {
          // For IDeposit and IChoice is the InputContent + the merkle object
          return {
            ...merkleizedHashAndContinuation,
            ...content,
          };
        }
      } else {
        return content;
      }
    }
    const environment = action.environment;

    switch (action.type) {
      case "Advance":
        return {
          inputs: [],
          environment,
        };
      case "Deposit":
        const deposit = action.deposit;
        const depositInput = await decorateInput(
          {
            input_from_party: deposit.party,
            // TODO: Check and add a test wether this should be the state as given by the contractDetails endpoint
            //       or the result of reducing it.
            that_deposits: evalValue(environment, contractDetails.currentState, deposit.deposits),
            of_token: deposit.of_token,
            into_account: deposit.into_account,
          },
          action.merkleizedContinuationHash
        );
        return {
          inputs: [depositInput],
          environment,
        };
      case "Notify":
        const notifyInput = await decorateInput("input_notify", action.merkleizedContinuationHash);
        return {
          inputs: [notifyInput],
          environment,
        };
      case "Choice":
        const choice = action.choice;
        // TODO: Improve errors
        if (!chosenNum) {
          throw new Error("Chosen number is not provided");
        }
        if (!inBounds(chosenNum, choice.choose_between)) {
          throw new Error("Chosen number is not in bounds");
        }

        const choiceInput = await decorateInput(
          {
            for_choice_id: choice.for_choice,
            input_that_chooses_num: chosenNum,
          },
          action.merkleizedContinuationHash
        );
        return {
          inputs: [choiceInput],
          environment,
        };
    }
  }
  return doMakeApplicableInput;
}

/**
 * @hidden
 */
export function simulateApplicableInput(
  contractDetails: ActiveContract,
  applicableInput: ApplicableInput
): TransactionSuccess {
  const txOut = computeTransaction(
    {
      tx_interval: applicableInput.environment.timeInterval,
      tx_inputs: applicableInput.inputs,
    },
    contractDetails.currentState,
    contractDetails.currentContract
  );
  if ("transaction_error" in txOut) {
    // TODO: Improve error
    throw new Error("There was a transaction error" + txOut.transaction_error);
  }
  return txOut;
}

function getApplicant(action: ApplicableAction): ActionApplicant {
  switch (action.type) {
    case "Notify":
    case "Advance":
      return "anybody";
    case "Deposit":
      return action.deposit.party;
    case "Choice":
      return action.choice.for_choice.choice_owner;
  }
}

/**
 * @hidden
 */
export type ChainTipDI = {
  getRuntimeTip: () => Promise<Date>;
};

/**
 * Computes a "safe" environment for the contract.
 * @hidden
 */
async function computeEnvironment({ getRuntimeTip }: ChainTipDI, currentContract: Contract): Promise<Environment> {
  const oneDayFrom = (time: Timeout) => time + 24n * 60n * 60n * 1000n; // in milliseconds
  // For the lower, bound we use the tip of the runtime chain.
  // If we used new Date(), the runtime can complain that the lower bound is too high
  // because it is ahead of the time that it knows.
  const tip = await getRuntimeTip();

  const lowerBound = datetoTimeout(tip);

  // For the upper bound, we use the next timeout if available or one day from the lower bound.
  // IMPORTANT NOTE: With this code, if the upper bound is far into the future, and this interval
  //                 is used when applying an input, you can end up with a Slot conversion error.
  //                 This is because the ledger can change the slot length at particular times
  //                 so the runtime cannot predict what is the exact slot.
  //                 The safe way to solve this is to get the network parameters from the runtime
  //                 and instead of doing oneDayFrom, do the max safe conversion.
  const upperBound = getNextTimeout(currentContract, lowerBound) ?? oneDayFrom(lowerBound);

  return { timeInterval: { from: lowerBound, to: upperBound - 1n } };
}

type GetApplicableActionsDI = GetContinuationDI & ChainTipDI;

/**
 * @hidden
 */
export function getApplicableActions(di: GetApplicableActionsDI) {
  return async function (contractDetails: ContractDetails, environment?: Environment): Promise<ApplicableAction[]> {
    // If the contract is closed there are no applicable actions
    if (contractDetails.type === "closed") return [];

    const env = environment ?? (await computeEnvironment(di, contractDetails.currentContract));

    const initialReduce = reduceContractUntilQuiescent(
      env,
      contractDetails.currentState,
      contractDetails.currentContract
    );
    if (initialReduce == "TEAmbiguousTimeIntervalError") throw new Error("AmbiguousTimeIntervalError");

    let applicableActions: ApplicableAction[] = initialReduce.reduced
      ? [
          {
            type: "Advance",
            environment: env,
          },
        ]
      : [];
    const cont = initialReduce.continuation;
    if (typeof cont === "object" && "when" in cont) {
      const applicableActionsFromCases = cont.when.map((aCase) =>
        getApplicableActionFromCase(env, initialReduce.state, aCase)
      );
      applicableActions = applicableActions.concat(
        toApplicableActions(
          applicableActionsFromCases.reduce(
            mergeApplicableActionAccumulator.concat,
            mergeApplicableActionAccumulator.empty
          )
        )
      );
    }
    return applicableActions;
  };
}

/**
 * @hidden
 */
export async function mkPartyFilter(wallet: WalletAPI) {
  const address = await wallet.getUsedAddresses();
  const tokens = await wallet.getTokens();
  let tokenMap = new Map<PolicyId, RoleName[]>();
  function getTokenMap() {
    if (tokenMap.size === 0 && tokens.length > 0) {
      tokens.forEach((token) => {
        // Role tokens only have 1 element
        if (token.quantity > 1) return;

        const currentTokens = tokenMap.get(token.assetId.policyId) ?? [];
        currentTokens.push(token.assetId.assetName);
        tokenMap.set(token.assetId.policyId, currentTokens);
      });
    }
    return tokenMap;
  }

  return (party: Party, policyId: PolicyId) => {
    if ("role_token" in party) {
      const policyTokens = getTokenMap().get(policyId);
      if (policyTokens === undefined) return false;
      return policyTokens.includes(party.role_token);
    } else {
      return address.includes(party.address as AddressBech32);
    }
  };
}

/**
 * A filter function for applicable actions.
 * ```ts
 * const applicableActions = await lifecycle.applicableActions.getApplicableActions(contractId);
 * const myActionsFilter = await lifecycle.applicableActions.mkFilter(contractDetails);
 * const myActions = applicableActions.actions.filter(myActionsFilter);
 * ```
 * @see How to create the filter using {@link ApplicableActionsAPI.mkFilter | mkFilter}
 * @category ApplicableActionsAPI
 */
export type ApplicableActionsFilter = (action: ApplicableAction) => boolean;

/**
 * @see How to create the filter using {@link ApplicableActionsAPI.mkFilter | mkFilter}
 * @category ApplicableActionsAPI
 */
export type ApplicableActionsWithDetailsFilter = (action: ApplicableAction, contractDetails: ActiveContract) => boolean;

/**
 * @hidden
 */
export async function mkApplicableActionsFilter(wallet: WalletAPI) {
  const partyFilter = await mkPartyFilter(wallet);

  return (action: ApplicableAction, contractDetails: ActiveContract) => {
    const applicant = getApplicant(action);
    if (applicant === "anybody") return true;
    return partyFilter(applicant, contractDetails.roleTokenMintingPolicyId);
  };
}

function isDepositAction(action: Action): action is Deposit {
  return "party" in action;
}

function isNotify(action: Action): action is Notify {
  return "notify_if" in action;
}

function isChoice(action: Action): action is Choice {
  return "choose_between" in action;
}

/**
 * Internal data structure to be able to accumulate and later flatter applicable actions
 * @hidden
 */
type ApplicableActionAccumulator = {
  deposits: Record<string, CanDeposit>;
  choices: Record<string, CanChoose>;
  notifies: CanNotify | undefined;
};

const toApplicableActions = (accumulator: ApplicableActionAccumulator): ApplicableAction[] => {
  const deposits = Object.values(accumulator.deposits);
  const choices = Object.values(accumulator.choices);
  const notifies = accumulator.notifies ? [accumulator.notifies] : [];
  return [...deposits, ...choices, ...notifies];
};

const flattenDeposits = {
  concat: (fst: CanDeposit, snd: CanDeposit) => {
    return fst;
  },
};

const partyKey = (party: Party) => {
  if ("role_token" in party) {
    return `role_${party.role_token}`;
  } else {
    return `address_${party.address}`;
  }
};

const tokenKey = (token: Token) => {
  return `${token.currency_symbol}-${token.token_name}`;
};
const accumulatorFromDeposit = (env: Environment, state: MarloweState, action: CanDeposit) => {
  const { party, into_account, of_token, deposits } = action.deposit;
  const value = evalValue(env, state, deposits);

  const depositKey = `${partyKey(party)}-${partyKey(into_account)}-${tokenKey(of_token)}-${value}`;
  return {
    deposits: { [depositKey]: action },
    choices: {},
    notifies: undefined,
  };
};

const accumulatorFromChoice = (action: CanChoose) => {
  const { for_choice } = action.choice;
  const choiceKey = `${partyKey(for_choice.choice_owner)}-${for_choice.choice_name}`;
  return {
    deposits: {},
    choices: { [choiceKey]: action },
    notifies: undefined,
  };
};

const accumulatorFromNotify = (action: CanNotify) => {
  return {
    deposits: {},
    choices: {},
    notifies: action,
  };
};

function mergeBounds(bounds: Bound[]): Bound[] {
  const mergedBounds: Bound[] = [];

  const sortedBounds = [...bounds].sort((a, b) => (a.from > b.from ? 1 : a.from < b.from ? -1 : 0));

  let currentBound: Bound | null = null;

  for (const bound of sortedBounds) {
    if (currentBound === null) {
      currentBound = { ...bound };
    } else {
      if (bound.from <= currentBound.to) {
        currentBound.to = Big.max(currentBound.to, bound.to);
      } else {
        mergedBounds.push(currentBound);
        currentBound = { ...bound };
      }
    }
  }

  if (currentBound !== null) {
    mergedBounds.push(currentBound);
  }

  return mergedBounds;
}

const flattenChoices = {
  concat: (fst: CanChoose, snd: CanChoose): CanChoose => {
    const mergedBounds = mergeBounds(fst.choice.choose_between.concat(snd.choice.choose_between));
    return {
      type: "Choice",
      environment: fst.environment,
      choice: {
        for_choice: fst.choice.for_choice,
        choose_between: mergedBounds,
      },
    };
  },
};

const mergeApplicableActionAccumulator: Monoid<ApplicableActionAccumulator> = {
  empty: {
    deposits: {},
    choices: {},
    notifies: undefined,
  },
  concat: (fst, snd) => {
    return {
      deposits: R.union(flattenDeposits)(fst.deposits)(snd.deposits),
      choices: R.union(flattenChoices)(fst.choices)(snd.choices),
      notifies: fst.notifies ?? snd.notifies,
    };
  },
};

/**
 * @hidden
 */
export type GetContinuationDI = {
  getContractContinuation: (sourceId: ContractSourceId) => Promise<Contract>;
};

function getApplicableActionFromCase(env: Environment, state: MarloweState, aCase: Case): ApplicableActionAccumulator {
  if (isDepositAction(aCase.case)) {
    const deposit = aCase.case;
    return accumulatorFromDeposit(env, state, {
      type: "Deposit",
      deposit,
      environment: env,
    });
  } else if (isChoice(aCase.case)) {
    const choice = aCase.case;

    return accumulatorFromChoice({
      type: "Choice",
      choice,
      environment: env,
    });
  } else {
    const notify = aCase.case;
    if (!evalObservation(env, state, notify.notify_if)) {
      return mergeApplicableActionAccumulator.empty;
    }

    return accumulatorFromNotify({
      type: "Notify",
      environment: env,
    });
  }
}
