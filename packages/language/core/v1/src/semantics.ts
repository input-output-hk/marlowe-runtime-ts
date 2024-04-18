/**
 * This module exposes the semantic functions of the Marlowe language. They can be used
 * to simulate/test a contract.
```
import * as G from "@marlowe.io/language-core-v1/guards";
import { datetoTimeout } from "@marlowe.io/language-core-v1";
import { playTrace } from "@marlowe.io/language-core-v1/semantics";
import { role, lovelace } from "@marlowe.io/language-core-v1/playground-v1";
import { escrow } from "@marlowe.io/language-examples";

const contract = escrow({
  price: 100,
  depositTimeout: datetoTimeout(new Date("2050-06-01T00:00:00Z")),
  disputeTimeout: datetoTimeout(new Date("2050-06-02T00:00:00Z")),
  answerTimeout: datetoTimeout(new Date("2050-06-03T00:00:00Z")),
  arbitrageTimeout: datetoTimeout(new Date("2050-06-04T00:00:00Z")),
});

const txs = [
  {
    tx_interval: {
      from: datetoTimeout(new Date("2050-05-01T00:00:00Z")),
      to: datetoTimeout(new Date("2050-05-02T00:00:00Z")),
    },
    tx_inputs: [
      {
        input_from_party: role("Buyer"),
        that_deposits: 100n,
        of_token: lovelace,
        into_account: role("Seller"),
      },
      {
        for_choice_id: {
          choice_name: "Everything is alright",
          choice_owner: role("Buyer"),
        },
        input_that_chooses_num: 0n,
      },
    ],
  },
];

const txOut = playTrace(
  datetoTimeout(new Date("2000-06-01T00:00:00Z")),
  contract,
  txs
);

if (G.TransactionSuccess.is(txOut)) {
  const { state, contract, warnings, payments} = txOut;
  console.log(state, contract, warnings, payments);
}
```
 * @packageDocumentation
 */
import * as AssocMap from "@marlowe.io/adapter/assoc-map";
import { deepEqual } from "@marlowe.io/adapter/deep-equal";
import { Action } from "./actions.js";
import { choiceIdCmp, inBounds } from "./choices.js";
import { Case, Contract, matchContract } from "./contract.js";
import { Environment, TimeInterval } from "./environment.js";
import { IChoice, IDeposit, Input, InputContent } from "./inputs.js";
import { Party } from "./participants.js";
import { AccountId, matchPayee, Payee } from "./payee.js";
import { Accounts, accountsCmp, MarloweState } from "./state.js";
import { Token } from "./token.js";
import {
  AmbiguousTimeIntervalError,
  ApplyNoMatchError,
  AssertionFailed,
  HashMismatchError,
  IntervalError,
  NonPositiveDeposit,
  NonPositivePay,
  PartialPay,
  Payment,
  Shadowing,
  SingleInputTx,
  Transaction,
  TransactionError,
  TransactionOutput,
  TransactionWarning,
} from "./transaction.js";
import { matchObservation, matchValue, Observation, Value } from "./value-and-observation.js";
import * as G from "./guards.js";
import { POSIXTime } from "@marlowe.io/adapter/time";
import * as Big from "@marlowe.io/adapter/bigint";

export {
  Payment,
  Transaction,
  SingleInputTx,
  NonPositiveDeposit,
  NonPositivePay,
  PartialPay,
  Shadowing,
  AssertionFailed,
  TransactionWarning,
  InvalidInterval,
  IntervalInPast,
  IntervalError,
  AmbiguousTimeIntervalError,
  ApplyNoMatchError,
  UselessTransaction,
  HashMismatchError,
  TEIntervalError,
  TransactionError,
  TransactionSuccess,
  TransactionOutput,
} from "./transaction.js";
export { inBounds };
/**
 * The function moneyInAccount returns the number of tokens a particular AccountId has in their account.
 * @hidden
 */
function moneyInAccount(accountId: AccountId, token: Token, accounts: Accounts): bigint {
  return AssocMap.findWithDefault(accountsCmp, 0n, [accountId, token], accounts);
}

/**
 * The function updateMoneyInAccount sets the amount of tokens a particular AccountId has in their account,
 * overriding any previous value. Marlowe re- quires all accounts to have positive balances, so if the
 * function is called with a negative value or zero the entry is removed from the accounts.
 * @hidden
 */
function updateMoneyInAccount(accountId: AccountId, token: Token, amount: bigint, accounts: Accounts): Accounts {
  if (amount <= 0n) {
    return AssocMap.remove(accountsCmp, [accountId, token], accounts);
  } else {
    return AssocMap.insert(accountsCmp, [accountId, token], amount, accounts);
  }
}

/**
 * The function addMoneyToAccount increases the amount of tokens in an ac- count identified by a
 * particular AccountId. To ensure that the value always increases we check that money > 0.
 * @hidden
 */
function addMoneyToAccount(accountId: AccountId, token: Token, amount: bigint, accounts: Accounts): Accounts {
  if (amount <= 0n) {
    return accounts;
  } else {
    const balance = moneyInAccount(accountId, token, accounts);
    return updateMoneyInAccount(accountId, token, balance + amount, accounts);
  }
}

/**
 *
 * @param env
 * @param state
 * @param value
 * @returns
 * @category Evaluation
 */
export function evalValue(env: Environment, state: MarloweState, value: Value): bigint {
  return matchValue({
    availableMoney: ({ amount_of_token, in_account }) => moneyInAccount(in_account, amount_of_token, state.accounts),
    choiceValue: ({ value_of_choice }) => AssocMap.findWithDefault(choiceIdCmp, 0n, value_of_choice, state.choices),
    useValue: ({ use_value }) => AssocMap.findWithDefault(AssocMap.strCmp, 0n, use_value, state.boundValues),
    constant: (num) => num,
    negValue: (val) => -evalValue(env, state, val.negate),
    addValue: ({ add, and }) => evalValue(env, state, add) + evalValue(env, state, and),
    subValue: ({ value, minus }) => evalValue(env, state, value) - evalValue(env, state, minus),
    mulValue: ({ multiply, times }) => evalValue(env, state, multiply) * evalValue(env, state, times),
    divValue: ({ divide, by }) => {
      const n = evalValue(env, state, divide);
      const d = evalValue(env, state, by);
      if (d === 0n) {
        return 0n;
      }
      // TODO: Check division rounding. I think it is correct by doing some manual checks
      return n / d;
    },
    // TODO: from should be bigint.
    timeIntervalStart: () => BigInt(env.timeInterval.from),
    timeIntervalEnd: () => BigInt(env.timeInterval.to),
    cond: (c) => (evalObservation(env, state, c.if) ? evalValue(env, state, c.then) : evalValue(env, state, c.else)),
  })(value);
}
/**
 *
 * @param env
 * @param state
 * @param obs
 * @returns
 * @category Evaluation
 */
export function evalObservation(env: Environment, state: MarloweState, obs: Observation): boolean {
  return matchObservation({
    trueObs: () => true,
    falseObs: () => false,
    notObs: (o) => !evalObservation(env, state, o.not),
    andObs: ({ both, and }) => evalObservation(env, state, both) && evalObservation(env, state, and),
    orObs: ({ either, or }) => evalObservation(env, state, either) || evalObservation(env, state, or),
    choseSomething: ({ chose_something_for }) => AssocMap.member(choiceIdCmp, chose_something_for, state.choices),
    valueGE: ({ value, ge_than }) => evalValue(env, state, value) >= evalValue(env, state, ge_than),
    valueGT: ({ value, gt }) => evalValue(env, state, value) > evalValue(env, state, gt),
    valueLT: ({ value, lt }) => evalValue(env, state, value) < evalValue(env, state, lt),
    valueLE: ({ value, le_than }) => evalValue(env, state, value) <= evalValue(env, state, le_than),
    valueEQ: ({ value, equal_to }) => evalValue(env, state, value) === evalValue(env, state, equal_to),
  })(obs);
}

/**
 * @hidden
 */
type ReduceEffect = { type: "ReduceNoPayment" } | { type: "ReduceWithPayment"; payment: Payment };

/**
 * @hidden
 */
const ReduceNoPayment = { type: "ReduceNoPayment" } as const;

const ReduceWithPayment = (payment: Payment): ReduceEffect => ({
  type: "ReduceWithPayment",
  payment: payment,
});

const nonPositivePay = (warn: NonPositivePay): NonPositivePay => warn;

/**
 * @hidden
 */
const nonPositiveDeposit = (warn: NonPositiveDeposit): NonPositiveDeposit => warn;

/**
 * @hidden
 */
const partialPay = (warn: PartialPay): PartialPay => warn;

/**
 * @hidden
 */
const shadowing = (warn: Shadowing): Shadowing => warn;

const assertionFailed = "assertion_failed" as const;

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export type NoWarning = "NoWarning";

/**
 * @hidden
 */
const noWarning = "NoWarning" as const;

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export type ReduceWarning = NoWarning | NonPositivePay | PartialPay | Shadowing | AssertionFailed;

const ambiguousTimeIntervalError = "TEAmbiguousTimeIntervalError" as const;

/**
 * @hidden
 */
type ReduceStepResult =
  | { type: "NotReduced" }
  | {
      type: "Reduced";
      state: MarloweState;
      warning: ReduceWarning;
      effect: ReduceEffect;
      continuation: Contract;
    }
  | AmbiguousTimeIntervalError;

const NotReduced = { type: "NotReduced" } as const;

const Reduced = (obj: {
  state: MarloweState;
  warning: ReduceWarning;
  effect: ReduceEffect;
  continuation: Contract;
}): ReduceStepResult => ({
  type: "Reduced",
  ...obj,
});

/**
 * @hidden
 */
function refundOne(accounts: Accounts): [Party, Token, bigint, Accounts] | undefined {
  if (accounts.length > 0) {
    const [[party, token], balance] = accounts[0];
    const rest = accounts.slice(1);
    if (balance > 0n) {
      return [party, token, balance, rest];
    } else {
      return refundOne(rest);
    }
  }
}

/**
 * @hidden
 */
function giveMoney(
  accountId: AccountId,
  payee: Payee,
  token: Token,
  amount: bigint,
  accounts: Accounts
): [ReduceEffect, Accounts] {
  const newAccounts = matchPayee({
    account: (account) => addMoneyToAccount(account, token, amount, accounts),
    party: (_) => accounts,
  })(payee);
  return [
    {
      type: "ReduceWithPayment",
      payment: {
        payment_from: accountId,
        to: payee,
        amount: amount,
        token: token,
      },
    },
    newAccounts,
  ];
}

/**
 * @hidden
 */
function reduceContractStep(env: Environment, state: MarloweState, cont: Contract): ReduceStepResult {
  return matchContract<ReduceStepResult>({
    close: (closeContract) => {
      const refund = refundOne(state.accounts);
      if (typeof refund == "undefined") {
        return NotReduced;
      } else {
        const [party, token, amount, rest] = refund;
        const newState = { ...state, accounts: rest };
        return Reduced({
          state: newState,
          warning: noWarning,
          effect: ReduceWithPayment({
            payment_from: party,
            to: { party: party },
            amount: amount,
            token: token,
          }),
          continuation: closeContract,
        });
      }
    },
    pay: ({ pay, token, from_account, to, then }): ReduceStepResult => {
      const amountToPay = evalValue(env, state, pay);
      if (amountToPay <= 0n) {
        const warning = nonPositivePay({
          account: from_account,
          asked_to_pay: amountToPay,
          of_token: token,
          to_payee: to,
        });
        return Reduced({
          state: state,
          warning: warning,
          effect: ReduceNoPayment,
          continuation: then,
        });
      }
      const balance = moneyInAccount(from_account, token, state.accounts);
      const paidAmount = Big.min(amountToPay, balance);
      const newBalance = balance - paidAmount;
      const newAccs = updateMoneyInAccount(from_account, token, newBalance, state.accounts);
      const warning =
        paidAmount < amountToPay
          ? partialPay({
              account: from_account,
              asked_to_pay: amountToPay,
              of_token: token,
              to_payee: to,
              but_only_paid: paidAmount,
            })
          : noWarning;
      const [payEffect, finalAccs] = giveMoney(from_account, to, token, paidAmount, newAccs);
      return Reduced({
        state: { ...state, accounts: finalAccs },
        warning: warning,
        effect: payEffect,
        continuation: then,
      });
    },
    if: (ifCont) => {
      const newCont = evalObservation(env, state, ifCont.if) ? ifCont.then : ifCont.else;
      return Reduced({
        state: state,
        warning: noWarning,
        effect: ReduceNoPayment,
        continuation: newCont,
      });
    },
    when: (whenCont) => {
      if (env.timeInterval.to < whenCont.timeout) {
        return NotReduced;
      } else if (whenCont.timeout <= env.timeInterval.from) {
        return Reduced({
          state: state,
          warning: noWarning,
          effect: ReduceNoPayment,
          continuation: whenCont.timeout_continuation,
        });
      } else {
        return ambiguousTimeIntervalError;
      }
    },
    let: (letCont) => {
      const evaluatedValue = evalValue(env, state, letCont.be);
      const boundValues = AssocMap.insert(AssocMap.strCmp, letCont.let, evaluatedValue, state.boundValues);
      const oldValue = AssocMap.lookup(AssocMap.strCmp, letCont.let, state.boundValues);
      const warning =
        oldValue !== undefined
          ? shadowing({
              value_id: letCont.let,
              had_value: oldValue,
              is_now_assigned: evaluatedValue,
            })
          : noWarning;
      return Reduced({
        state: { ...state, boundValues: boundValues },
        warning: warning,
        effect: ReduceNoPayment,
        continuation: letCont.then,
      });
    },
    assert: (assertCont) => {
      const warning = evalObservation(env, state, assertCont.assert) ? noWarning : assertionFailed;
      return Reduced({
        state: state,
        warning: warning,
        effect: ReduceNoPayment,
        continuation: assertCont.then,
      });
    },
  })(cont);
}

/**
 * @hidden
 */
export type ContractQuiescentReduceResult = {
  type: "ContractQuiescent";
  reduced: boolean;
  state: MarloweState;
  warnings: ReduceWarning[];
  payments: Payment[];
  continuation: Contract;
};
/**
 * @hidden
 */
type ReduceResult = ContractQuiescentReduceResult | AmbiguousTimeIntervalError;

/**
 * @hidden
 */
export function reduceContractUntilQuiescent(env: Environment, state: MarloweState, cont: Contract): ReduceResult {
  function go(
    reduced: boolean,
    goState: MarloweState,
    goCont: Contract,
    goWarnings: ReduceWarning[],
    goPayments: Payment[]
  ): ReduceResult {
    const result = reduceContractStep(env, goState, goCont);
    if (result == ambiguousTimeIntervalError) {
      return result;
    }
    switch (result.type) {
      case "Reduced":
        const newWarnings = result.warning == "NoWarning" ? goWarnings : [...goWarnings, result.warning];
        const newPayments =
          result.effect.type == "ReduceNoPayment" ? goPayments : [...goPayments, result.effect.payment];
        return go(true, result.state, result.continuation, newWarnings, newPayments);
      case "NotReduced":
        return {
          type: "ContractQuiescent",
          reduced: reduced,
          state: goState,
          warnings: goWarnings,
          payments: goPayments,
          continuation: goCont,
        };
    }
  }
  return go(false, state, cont, [], []);
}

/**
 * @hidden
 */
type ApplyWarning = NoWarning | NonPositiveDeposit;

type ApplyAction = { type: "AppliedAction"; warning: ApplyWarning; state: MarloweState } | { type: "NotAppliedAction" };
const NotAppliedAction = { type: "NotAppliedAction" } as const;
const AppliedAction = (obj: { warning: ApplyWarning; state: MarloweState }): ApplyAction => ({
  type: "AppliedAction",
  ...obj,
});

function applyAction(env: Environment, state: MarloweState, input: InputContent, action: Action): ApplyAction {
  if (G.IDeposit.is(input) && G.Deposit.is(action)) {
    if (
      deepEqual(input.input_from_party, action.party) &&
      deepEqual(input.into_account, action.into_account) &&
      deepEqual(input.of_token, action.of_token) &&
      deepEqual(input.that_deposits, evalValue(env, state, action.deposits))
    ) {
      const warning =
        input.that_deposits > 0n
          ? noWarning
          : nonPositiveDeposit({
              party: action.party,
              asked_to_deposit: input.that_deposits,
              of_token: action.of_token,
              in_account: action.into_account,
            });
      const newAccounts = addMoneyToAccount(input.into_account, input.of_token, input.that_deposits, state.accounts);
      return AppliedAction({
        warning,
        state: { ...state, accounts: newAccounts },
      });
    }
  } else if (G.IChoice.is(input) && G.Choice.is(action)) {
    if (
      deepEqual(input.for_choice_id, action.for_choice) &&
      inBounds(input.input_that_chooses_num, action.choose_between)
    ) {
      const newChoices = AssocMap.insert(choiceIdCmp, input.for_choice_id, input.input_that_chooses_num, state.choices);
      return AppliedAction({
        warning: noWarning,
        state: { ...state, choices: newChoices },
      });
    }
  } else if (G.INotify.is(input) && G.Notify.is(action)) {
    if (evalObservation(env, state, action.notify_if)) {
      return AppliedAction({ warning: noWarning, state });
    }
  }
  return NotAppliedAction;
}

function getContinuation(input: Input, cse: Case): Contract | undefined {
  if (G.NormalInput.is(input) && G.NormalCase.is(cse)) {
    return cse.then;
  }
  if (G.MerkleizedInput.is(input) && G.MerkleizedCase.is(cse) && input.continuation_hash == cse.merkleized_then) {
    return input.merkleized_continuation;
  }
  return undefined;
}

/**
 * @hidden
 */
type AppliedResult = {
  type: "Applied";
  warning: ApplyWarning;
  state: MarloweState;
  continuation: Contract;
};
const AppliedResult = (obj: { warning: ApplyWarning; state: MarloweState; continuation: Contract }): AppliedResult => ({
  type: "Applied",
  ...obj,
});

/**
 * Small type guard helper that is not 100% accurate (for real unknowns) but it doesn't check all the properties
 * which can be lengthy. It is fine in this context as it is only used internal to this file, where we know what properties
 * we are using.
 * @hidden
 */
function isApplied(obj: unknown): obj is AppliedResult {
  return typeof obj === "object" && obj !== null && "type" in obj && obj.type === "Applied";
}

const noMatchError = "TEApplyNoMatchError" as const;

const hashMismatchError = "TEHashMismatch" as const;

type ApplyResult = AppliedResult | ApplyNoMatchError | HashMismatchError;

function inputToInputContent(input: Input): InputContent {
  if (input === "input_notify") {
    return "input_notify";
  }
  if ("that_deposits" in input) {
    input;
    return input as IDeposit;
  }
  if ("input_that_chooses_num" in input) {
    input;
    return input as IChoice;
  }
  return "input_notify";
}
/**
 * @hidden
 */
function applyCases(env: Environment, state: MarloweState, input: Input, cases: Case[]): ApplyResult {
  if (cases.length === 0) return noMatchError;
  const [headCase, ...tailCases] = cases;
  const action = headCase.case;
  const cont = getContinuation(input, headCase);
  const result = applyAction(env, state, inputToInputContent(input), action);
  switch (result.type) {
    case "AppliedAction":
      if (typeof cont === "undefined") {
        return hashMismatchError;
      } else {
        return AppliedResult({
          warning: result.warning,
          state: result.state,
          continuation: cont,
        });
      }

    case "NotAppliedAction":
      return applyCases(env, state, input, tailCases);
  }
}

/**
 * @hidden
 */
function applyInput(env: Environment, state: MarloweState, input: Input, cont: Contract): ApplyResult {
  return (
    matchContract({
      when: (whenCont) => applyCases(env, state, input, whenCont.when),
    })(cont) ?? noMatchError
  );
}

export function convertReduceWarning(warnings: ReduceWarning[]): TransactionWarning[] {
  return warnings.filter((w) => w !== "NoWarning") as TransactionWarning[];
}

function convertApplyWarning(warning: ApplyWarning): TransactionWarning[] {
  if (warning === "NoWarning") {
    return [];
  }
  return [warning];
}

type ApplyAllSuccess = {
  type: "ApplyAllSuccess";
  contractChanged: boolean;
  warnings: TransactionWarning[];
  payments: Payment[];
  state: MarloweState;
  continuation: Contract;
};
const ApplyAllSuccess = (obj: {
  contractChanged: boolean;
  warnings: TransactionWarning[];
  payments: Payment[];
  state: MarloweState;
  continuation: Contract;
}): ApplyAllSuccess => ({ type: "ApplyAllSuccess", ...obj });

/**
 * Small type guard helper that is not 100% accurate (for real unknowns) but it doesn't check all the properties
 * which can be lengthy. It is fine in this context as it is only used internal to this file, where we know what properties
 * we are using.
 * @hidden
 */
function isApplyAllSuccess(obj: unknown): obj is ApplyAllSuccess {
  return typeof obj === "object" && obj !== null && "type" in obj && obj.type === "ApplyAllSuccess";
}

type ApplyAllResult = ApplyAllSuccess | ApplyNoMatchError | AmbiguousTimeIntervalError | HashMismatchError;

/**
 * @hidden
 */
export function applyAllInputs(env: Environment, state: MarloweState, cont: Contract, inputs: Input[]): ApplyAllResult {
  function go(
    contractChanged: boolean,
    goState: MarloweState,
    goCont: Contract,
    goInputs: Input[],
    goWarnings: TransactionWarning[],
    goPayments: Payment[]
  ): ApplyAllResult {
    const reduceResult = reduceContractUntilQuiescent(env, goState, goCont);
    if (reduceResult == ambiguousTimeIntervalError) {
      return reduceResult;
    }
    switch (reduceResult.type) {
      case "ContractQuiescent":
        const newWarnigns = [...goWarnings, ...convertReduceWarning(reduceResult.warnings)];
        const newPayments = [...goPayments, ...reduceResult.payments];
        if (goInputs.length == 0) {
          return ApplyAllSuccess({
            contractChanged: contractChanged || reduceResult.reduced,
            warnings: newWarnigns,
            payments: newPayments,
            state: reduceResult.state,
            continuation: reduceResult.continuation,
          });
        } else {
          const [headInput, ...tailInputs] = goInputs;
          const applyResult = applyInput(env, reduceResult.state, headInput, reduceResult.continuation);
          if (isApplied(applyResult)) {
            return go(
              true,
              applyResult.state,
              applyResult.continuation,
              tailInputs,
              [...newWarnigns, ...convertApplyWarning(applyResult.warning)],
              newPayments
            );
          } else {
            return applyResult;
          }
        }
    }
  }
  return go(false, state, cont, inputs, [], []);
}

type IntervalTrimmed = {
  type: "IntervalTrimmed";
  environment: Environment;
  state: MarloweState;
};
const intervalTrimmed = (obj: { environment: Environment; state: MarloweState }): IntervalTrimmed => ({
  type: "IntervalTrimmed",
  ...obj,
});

const invalidInterval = (from: bigint, to: bigint): IntervalError => ({
  invalidInterval: { from, to },
});
const intervalInPastError = (from: bigint, to: bigint, minTime: bigint): IntervalError => ({
  intervalInPastError: { from, to, minTime },
});

type IntervalResult = IntervalTrimmed | IntervalError;

function fixInterval(interval: TimeInterval, state: MarloweState): IntervalResult {
  if (interval.to < interval.from) return invalidInterval(interval.from, interval.to);
  if (interval.to < state.minTime) return intervalInPastError(interval.from, interval.to, state.minTime);
  const newFrom = Big.max(interval.from, state.minTime);
  const environment = { timeInterval: { from: newFrom, to: interval.to } };
  return intervalTrimmed({
    environment,
    state: { ...state, minTime: newFrom },
  });
}

function transactionError(transaction_error: TransactionError) {
  return { transaction_error };
}

/**
 * Given a {@link Contract} in a {@link MarloweState | State}, `computeTransaction` will
 * apply a {@link Transaction} to move the contract forward, returning the new state and the contract
 * continuation, along with any {@link TransactionWarning | warnings} and {@link Payment | payments} that may be generated.
 *
 * This function is called on the blockchain as part of the transaction validation, and can
 * be used to simulate the execution of a contract.
 * @param tx The transaction to apply
 * @param state The current state
 * @param cont The current contract
 * @returns Wether the transaction was successful or not and the new state of the contract.
 * @category Evaluation
 */
export function computeTransaction(tx: Transaction, state: MarloweState, cont: Contract): TransactionOutput {
  const fixIntervalResult = fixInterval(tx.tx_interval, state);

  if (G.IntervalError.is(fixIntervalResult)) {
    return transactionError({
      error: "TEIntervalError",
      context: fixIntervalResult,
    } as const);
  }
  const applyAllInputsResult = applyAllInputs(
    fixIntervalResult.environment,
    fixIntervalResult.state,
    cont,
    tx.tx_inputs
  );
  if (isApplyAllSuccess(applyAllInputsResult)) {
    if (!applyAllInputsResult.contractChanged && (!G.Close.is(cont) || state.accounts.length == 0)) {
      return transactionError("TEUselessTransaction");
    } else {
      return {
        warnings: applyAllInputsResult.warnings,
        payments: applyAllInputsResult.payments,
        state: applyAllInputsResult.state,
        contract: applyAllInputsResult.continuation,
      };
    }
  } else {
    return transactionError(applyAllInputsResult);
  }
}

/**
 * Creates an empty {@link MarloweState} using the given minimum time.
 * @param minTime A known time in the past.
 * @category Evaluation
 */
export function emptyState(minTime: POSIXTime): MarloweState {
  return {
    accounts: [],
    boundValues: [],
    choices: [],
    minTime,
  };
}

/**
 * While {@link computeTransaction} can move a contract forward with a single transaction
 * from a previous state, `playTrace` is used to simulate the execution of a contract from the
 * start, using a list of transactions.
 *
 * `playtrace` calls {@link computeTransaction} for each transaction in the list, accumulating
 * the warnings and payments generated by each transaction. If a transaction fails, the error
 * is returned. If all the transaction succeed, the resulting state and contract are returned
 * along with the accumulated warnings and payments.
 *
 * @param initialTime Time when the execution of the contract starts.
 * @param contract The contract to trace.
 * @param transactions The list of transactions to apply.
 * @returns The resulting state and contract, along with the accumulated warnings and payments or a {@link TransactionError}.
 * @category Evaluation
 */
export function playTrace(initialTime: POSIXTime, contract: Contract, transactions: Transaction[]): TransactionOutput {
  function go(prev: TransactionOutput, txs: Transaction[]): TransactionOutput {
    if (txs.length === 0) return prev;
    if (!G.TransactionSuccess.is(prev)) return prev;
    const [txHead, ...txTail] = txs;
    const next = computeTransaction(txHead, prev.state, prev.contract);
    if (!G.TransactionSuccess.is(next)) return next;
    return go(
      {
        payments: prev.payments.concat(next.payments),
        warnings: prev.warnings.concat(next.warnings),
        state: next.state,
        contract: next.contract,
      },
      txTail
    );
  }
  return go(
    {
      warnings: [],
      payments: [],
      contract,
      state: emptyState(initialTime),
    },
    transactions
  );
}

export function playSingleInputTxTrace(initialTime: POSIXTime, contract: Contract, transactions: SingleInputTx[]) {
  const txs = transactions.map((tx) => {
    const tx_inputs = typeof tx.input === "undefined" ? [] : [tx.input];
    return {
      tx_interval: tx.interval,
      tx_inputs,
    };
  });
  return playTrace(initialTime, contract, txs);
}
