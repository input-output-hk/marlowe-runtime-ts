import * as t from "io-ts/lib/index.js";
import { Observation, ObservationGuard, Value, ValueId } from "./value-and-observation.js";
import { AccountId, AccountIdGuard, Payee } from "./payee.js";
import { PayeeGuard } from "./payee.js";
import { Token, TokenGuard } from "./token.js";
import { ValueGuard, ValueIdGuard } from "./value-and-observation.js";
import { Action, ActionGuard } from "./actions.js";
import { pipe } from "fp-ts/lib/function.js";
import getUnixTime from "date-fns/getUnixTime/index.js";
import { BuiltinByteString } from "./inputs.js";
import * as Big from "@marlowe.io/adapter/bigint";
import { likeLiteral } from "@marlowe.io/adapter/io-ts";
/**
 * Search [[lower-name-builders]]
 * @hidden
 */
export const close = "close";
/**
 * TODO: Comment
 * @category Contract
 */
export type Close = "close";

/**
 * TODO: Comment
 * @category Contract
 */
// NOTE: Previously the Close guard was defined as a literal string, but now it is relaxed to something that
//       can be coerced to "close" so that we can use String("close") as well. The reason for doing this is
//       to allow annotations on a Close contract, which couldn't be done with plain string primitives.
// export const CloseGuard: t.Type<Close> = t.literal("close");
export const CloseGuard: t.Type<Close> = likeLiteral("close");
/**
 * @hidden
 */
//
// [[lower-name-builders]] DISCUSSION:
//     What should we do with the lower case constructors? close, pay, role, etc... There are some that are impossible to
//     make, for example `let` and `if` which are reserved words in JS. For the moment I'm hidding them from the API.
export const pay = (pay: Value, token: Token, from_account: AccountId, to: Payee, then: Contract) => ({
  pay: pay,
  token: token,
  from_account: from_account,
  to: to,
  then: then,
});

/**
 * TODO: Comment
 * @category Contract
 */
export interface Pay {
  pay: Value;
  token: Token;
  from_account: AccountId;
  to: Payee;
  then: Contract;
}

/**
 * TODO: Comment
 * @category Contract
 */
export const PayGuard = t.recursion<Pay>("Pay", () =>
  t.type({
    pay: ValueGuard,
    token: TokenGuard,
    from_account: AccountIdGuard,
    to: PayeeGuard,
    then: ContractGuard,
  })
);

/**
 * TODO: Comment
 * @category Contract
 */
export interface If {
  /**
   * TODO: Comment
   */
  if: Observation;
  /**
   * TODO: Comment
   */
  then: Contract;
  /**
   * TODO: Comment
   */
  else: Contract;
}

/**
 * TODO: Comment
 * @category Contract
 */
export const IfGuard: t.Type<If> = t.recursion("If", () =>
  t.type({ if: ObservationGuard, then: ContractGuard, else: ContractGuard })
);

/**
 * The `Let` constructor allows a contract to record a value using an identifier `let`. The
 * expression `be` is evaluated, and the result is stored in the `boundValues` of the {@link MarloweState}
 * with the `let` identifier. The contract then continues with `then`.
 *
 * As well as allowing us to use abbreviations, this mechanism also means that we can capture and save
 * volatile values that might be changing with time, e.g. the current price of oil, or the current time,
 * at a particular point in the execution of the contract, to be used later on in contract execution.
 * @see Section 2.1.7 and appendix E.10 of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe spec}
 * @category Contract
 */
export interface Let {
  let: ValueId;
  be: Value;
  then: Contract;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Let | let type}.
 * @category Contract
 */
export const LetGuard: t.Type<Let> = t.recursion("Let", () =>
  t.type({ let: ValueIdGuard, be: ValueGuard, then: ContractGuard })
);

/**
 * TODO: Comment
 * @category Contract
 */
export interface Assert {
  /**
   * TODO: Comment
   */
  assert: Observation;
  /**
   * TODO: Comment
   */
  then: Contract;
}

/**
 * TODO: Comment
 * @category Contract
 */
export const AssertGuard: t.Type<Assert> = t.recursion("Assert", () =>
  t.type({ assert: ObservationGuard, then: ContractGuard })
);

/**
 * TODO: Comment
 * @category Contract
 */
export interface When {
  /**
   * TODO: Comment
   */
  when: Case[];
  /**
   * TODO: Comment
   */
  timeout: Timeout;
  /**
   * TODO: Comment
   */
  timeout_continuation: Contract;
}
/**
 * TODO: Comment
 * @category Contract
 */
export const WhenGuard: t.Type<When> = t.recursion("When", () =>
  t.type({
    when: t.array(CaseGuard),
    timeout: TimeoutGuard,
    timeout_continuation: ContractGuard,
  })
);

/**
 * A pattern match between an Action and a Contract.
 * To be used inside of a {@link When} statement.
 * @category Contract
 */
export interface NormalCase {
  /**
   * TODO: Comment
   */
  case: Action;
  /**
   * TODO: Comment
   */
  then: Contract;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link NormalCase | normal case type}.
 * @category Contract
 */
export const NormalCaseGuard: t.Type<NormalCase> = t.recursion("Case", () =>
  t.type({ case: ActionGuard, then: ContractGuard })
);

/**
 * A pattern match between an Action and a Merkleized Contract.
 * To be used inside of a {@link When} statement.
 * @see {@link https://docs.marlowe.iohk.io/docs/platform-and-architecture/large-contracts}
 * @category Contract
 */
export interface MerkleizedCase {
  case: Action;
  /**
   * A hash of the contract that will be executed if the case is matched.
   * Never construct this value yourself, the runtime should calculate hashing.
   */
  merkleized_then: BuiltinByteString;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link MerkleizedCase | merkleized case type}.
 * @category Contract
 */
export const MerkleizedCaseGuard: t.Type<MerkleizedCase> = t.type({
  case: ActionGuard,
  merkleized_then: t.string,
});

/**
 * @category Contract
 */
export type Case = NormalCase | MerkleizedCase;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Case | case type}.
 * @category Contract
 */
export const CaseGuard: t.Type<Case> = t.recursion("Case", () => t.union([NormalCaseGuard, MerkleizedCaseGuard]));

/**
 * TODO: Comment
 * @category Contract
 */
export type Timeout = bigint;
/**
 * TODO: Comment
 * @category Contract
 */
export const TimeoutGuard: t.Type<Timeout> = t.bigint;

/**
 * @experimental
 */
// DISCUSSION: I think this should be renamed dateToPOSIX and moved to the time module in the adapter package
export const datetoTimeout = (date: Date): Timeout =>
  pipe(
    date,
    getUnixTime,
    (a) => a * 1_000,
    BigInt,
    (a) => a.valueOf()
  );

/**
 * @experimental
 */
// DISCUSSION: I think this should be renamed POSIXtoDate and moved to the time module in the adapter package
export const timeoutToDate = (timeout: Timeout): Date => new Date(Number(timeout));

/**
 * TODO: Comment
 * @category Contract
 */
export type Contract = Close | Pay | If | When | Let | Assert;

/**
 * TODO: Comment
 * @category Contract
 */
export const ContractGuard: t.Type<Contract> = t.recursion("Contract", () =>
  t.union([CloseGuard, PayGuard, IfGuard, WhenGuard, LetGuard, AssertGuard])
);

/**
 * Pattern match object on the Contract type
 * @category Contract
 * @hidden
 */
export type ContractMatcher<T> = {
  close: (contract: Close) => T;
  pay: (contract: Pay) => T;
  if: (contract: If) => T;
  when: (contract: When) => T;
  let: (contract: Let) => T;
  assert: (contract: Assert) => T;
};

/**
 * Pattern matching on the Contract type
 * @hidden
 * @category Contract
 */
export function matchContract<T>(matcher: ContractMatcher<T>): (contract: Contract) => T;
export function matchContract<T>(matcher: Partial<ContractMatcher<T>>): (contract: Contract) => T | undefined;
export function matchContract<T>(matcher: Partial<ContractMatcher<T>>) {
  return (contract: Contract) => {
    if (CloseGuard.is(contract) && matcher.close) {
      return matcher.close(contract);
    } else if (PayGuard.is(contract) && matcher.pay) {
      return matcher.pay(contract);
    } else if (IfGuard.is(contract) && matcher.if) {
      return matcher.if(contract);
    } else if (WhenGuard.is(contract) && matcher.when) {
      return matcher.when(contract);
    } else if (LetGuard.is(contract) && matcher.let) {
      return matcher.let(contract);
    } else if (AssertGuard.is(contract) && matcher.assert) {
      return matcher.assert(contract);
    }
  };
}

/**
 * This function calculates the next timeout of a contract after a given minTime.
 * @param minTime Normally the current time, but it represents any time for which you want to see what is the next timeout after that.
 * @param contract The contract to analyze
 * @returns The next timeout after minTime, or undefined if there is no timeout after minTime.
 * @category Introspection
 */
export function getNextTimeout(contract: Contract, minTime: Timeout): Timeout | undefined {
  return matchContract<Timeout | undefined>({
    close: () => undefined,
    pay: (pay) => getNextTimeout(pay.then, minTime),
    if: (ifContract) => {
      const thenTimeout = getNextTimeout(ifContract.then, minTime);
      const elseTimeout = getNextTimeout(ifContract.else, minTime);
      return thenTimeout && elseTimeout ? Big.min(thenTimeout, elseTimeout) : thenTimeout || elseTimeout;
    },
    when: (whenContract) => {
      if (minTime > whenContract.timeout) {
        return getNextTimeout(whenContract.timeout_continuation, minTime);
      } else {
        return whenContract.timeout;
      }
    },
    let: (letContract) => getNextTimeout(letContract.then, minTime),
    assert: (assertContract) => getNextTimeout(assertContract.then, minTime),
  })(contract);
}
