/**
 * Compatibility module with the Playground's internal `marlowe-js` library. To migrate existing projects follow
 * the instructions in the [playground compatibility guide](https://github.com/input-output-hk/marlowe-ts-sdk/blob/main/doc/playground-compatibility.md)
 *
  ```
  import {
      Contract, Address, Role, Account, Party, ada, lovelace, AvailableMoney, Constant,
      NegValue, AddValue, SubValue, MulValue, DivValue, ChoiceValue, TimeIntervalStart,
      TimeIntervalEnd, UseValue, Cond, AndObs, OrObs, NotObs, ChoseSomething,
      ValueGE, ValueGT, ValueLT, ValueLE, ValueEQ, TrueObs, FalseObs, Deposit,
      Choice, Notify, Close, Pay, If, When, Let, Assert, SomeNumber, AccountId,
      ChoiceId, Token, ValueId, Value, EValue, Observation, Bound, Action, Payee,
      Case, Timeout, ETimeout
    } from "@marlowe.io/language-core-v1/playground-v1";

    function myContract(): Contract {
      return Close;
    }
  ```
 * @packageDocumentation
 */
import * as C from "./index.js";
import type { Timeout, Value, Party, ChoiceId, Token, Contract, Observation, Action, Payee, Case } from "./index.js";
export { Timeout, Value, Party, ChoiceId, Token, Contract, Observation, Action, Payee, Case };

export type SomeNumber = number | string | bigint;

function coerceNumber(n: SomeNumber): bigint {
  var isNumeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  if (typeof n == "string" && isNumeric.test(String(n))) {
    return BigInt(n);
  } else if (typeof n == "bigint") {
    return n;
  } else if (typeof n == "number") {
    if (n > Number.MAX_SAFE_INTEGER || n < -Number.MAX_SAFE_INTEGER) {
      throw new Error("Unsafe use of JavaScript numbers. For amounts this large, please use bigint.");
    }
    return BigInt(n);
  } else {
    throw new Error("Not a valid number");
  }
}

export const Address = function (address: string): Party {
  return { address: address };
};

export const Role = function (roleToken: string): Party {
  return { role_token: roleToken };
};

export type AccountId = Party;

const ChoiceId = function (choiceName: string, choiceOwner: Party): ChoiceId {
  return { choice_name: choiceName, choice_owner: choiceOwner };
};

const Token = function (currencySymbol: string, tokenName: string): Token {
  var regexp = /^([0-9a-f][0-9a-f])*$/g;
  if (currencySymbol.match(regexp)) {
    return { currency_symbol: currencySymbol, token_name: tokenName };
  } else {
    throw new Error("Currency symbol must be base16");
  }
};

/**
 * @deprecated Use lovelace instead
 */
export const ada: Token = { currency_symbol: "", token_name: "" };
export const lovelace: Token = { currency_symbol: "", token_name: "" };

type ValueId = string;

export const ValueId = function (valueIdentifier: string): ValueId {
  return valueIdentifier;
};

export type EValue = SomeNumber | Value;

function coerceValue(val: EValue): Value {
  if (typeof val == "number") {
    if (val > Number.MAX_SAFE_INTEGER || val < -Number.MAX_SAFE_INTEGER) {
      throw new Error("Unsafe use of JavaScript numbers. For amounts this large, please use bigint.");
    }
    return BigInt(val);
  } else if (typeof val == "bigint") {
    return val;
  } else if (typeof val == "string" && val != "time_interval_start" && val != "time_interval_end") {
    return BigInt(val);
  } else {
    return val;
  }
}

export const AvailableMoney = function (token: Token, accountId: AccountId): Value {
  return { amount_of_token: token, in_account: accountId };
};

export const Constant = function (number: SomeNumber): Value {
  return coerceNumber(number);
};

export const NegValue = function (value: EValue): Value {
  return { negate: coerceValue(value) };
};

export const AddValue = function (lhs: EValue, rhs: EValue): Value {
  return { add: coerceValue(lhs), and: coerceValue(rhs) };
};

export const SubValue = function (lhs: EValue, rhs: EValue): Value {
  return { value: coerceValue(lhs), minus: coerceValue(rhs) };
};

export const MulValue = function (lhs: EValue, rhs: EValue): Value {
  return { multiply: coerceValue(lhs), times: coerceValue(rhs) };
};

export const DivValue = function (lhs: EValue, rhs: EValue): Value {
  return { divide: coerceValue(lhs), by: coerceValue(rhs) };
};

export const ChoiceValue = function (choiceId: ChoiceId): Value {
  return { value_of_choice: choiceId };
};

export const TimeIntervalStart: Value = "time_interval_start";

export const TimeIntervalEnd: Value = "time_interval_end";

export const UseValue = function (valueId: ValueId): Value {
  return { use_value: valueId };
};

export const Cond = function (obs: Observation, contThen: EValue, contElse: EValue): Value {
  return { if: obs, then: coerceValue(contThen), else: coerceValue(contElse) };
};

export const AndObs = function (lhs: Observation, rhs: Observation): Observation {
  return { both: lhs, and: rhs };
};

export const OrObs = function (lhs: Observation, rhs: Observation): Observation {
  return { either: lhs, or: rhs };
};

export const NotObs = function (obs: Observation): Observation {
  return { not: obs };
};

export const ChoseSomething = function (choiceId: ChoiceId): Observation {
  return { chose_something_for: choiceId };
};

export const ValueGE = function (lhs: EValue, rhs: EValue): Observation {
  return { value: coerceValue(lhs), ge_than: coerceValue(rhs) };
};

export const ValueGT = function (lhs: EValue, rhs: EValue): Observation {
  return { value: coerceValue(lhs), gt: coerceValue(rhs) };
};

export const ValueLT = function (lhs: EValue, rhs: EValue): Observation {
  return { value: coerceValue(lhs), lt: coerceValue(rhs) };
};

export const ValueLE = function (lhs: EValue, rhs: EValue): Observation {
  return { value: coerceValue(lhs), le_than: coerceValue(rhs) };
};

export const ValueEQ = function (lhs: EValue, rhs: EValue): Observation {
  return { value: coerceValue(lhs), equal_to: coerceValue(rhs) };
};

export const TrueObs: Observation = true;

export const FalseObs: Observation = false;

export const Bound = function (boundMin: SomeNumber, boundMax: SomeNumber): C.Bound {
  return { from: coerceNumber(boundMin), to: coerceNumber(boundMax) };
};

export const Deposit = function (accId: AccountId, party: Party, token: Token, value: EValue): Action {
  return {
    party: party,
    deposits: coerceValue(value),
    of_token: token,
    into_account: accId,
  };
};

export const Choice = function (choiceId: ChoiceId, bounds: C.Bound[]): Action {
  return { choose_between: bounds, for_choice: choiceId };
};

export const Notify = function (obs: Observation): Action {
  return { notify_if: obs };
};

export function Account(party: Party): Payee {
  return { account: party };
}

function Party(party: Party): Payee {
  return { party: party };
}

const Case = function (caseAction: Action, continuation: Contract): Case {
  return { case: caseAction, then: continuation };
};

export type ETimeout = SomeNumber;

export const Close: Contract = "close";

export const Pay = function (
  accId: AccountId,
  payee: Payee,
  token: Token,
  value: EValue,
  continuation: Contract
): Contract {
  return {
    pay: coerceValue(value),
    token: token,
    from_account: accId,
    to: payee,
    then: continuation,
  };
};

export const If = function (obs: Observation, contThen: Contract, contElse: Contract): Contract {
  return { if: obs, then: contThen, else: contElse };
};

export const When = function (cases: Case[], timeout: ETimeout, timeoutCont: Contract): Contract {
  var coercedTimeout: Timeout;
  if (typeof timeout == "object") {
    coercedTimeout = timeout;
  } else {
    coercedTimeout = coerceNumber(timeout);
  }
  return {
    when: cases,
    timeout: coercedTimeout,
    timeout_continuation: timeoutCont,
  };
};

export const Let = function (valueId: ValueId, value: Value, cont: Contract): Contract {
  return { let: valueId, be: value, then: cont };
};

export const Assert = function (obs: Observation, cont: Contract): Contract {
  return { assert: obs, then: cont };
};
