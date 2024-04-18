import * as t from "io-ts/lib/index.js";
import { AssocMap, AssocMapGuard, Sort } from "@marlowe.io/adapter/assoc-map";
import { AccountId, AccountIdGuard } from "./payee.js";

import { ValueId, ValueIdGuard } from "./value-and-observation.js";
import { Token, tokenCmp, TokenGuard } from "./token.js";
import { ChoiceId, ChoiceIdGuard } from "./choices.js";
import { partyCmp } from "./participants.js";

export type Account = t.TypeOf<typeof Account>;
export const Account = t.tuple([t.tuple([AccountIdGuard, TokenGuard]), t.bigint]);

/**
 * The Marlowe model allows for a contract to store assets. All participants of the contract implicitly
 * own an account identified with an AccountId.
 *
 * All assets stored in the contract must be in an internal account for one of the parties; this way,
 * when the contract is closed, all remaining assets can be redeemed by their respective owners.
 * These accounts are local: they only exist (and are accessible) within the contract.
 * @category State
 * @see Section 2.1.3 of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe spec}
 */
export type Accounts = AssocMap<[AccountId, Token], bigint>;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Accounts | accounts type}.
 * @category State
 */
export const AccountsGuard: t.Type<Accounts> = AssocMapGuard(t.tuple([AccountIdGuard, TokenGuard]), t.bigint);

/**
 * Sorting function for Accounts
 * @hidden
 */
export function accountsCmp(a: [AccountId, Token], b: [AccountId, Token]): Sort {
  const accIdCmp = partyCmp(a[0], b[0]);
  if (accIdCmp !== "EqualTo") {
    return accIdCmp;
  }
  return tokenCmp(a[1], b[1]);
}

/**
 * The state of a Marlowe Contract is stored in the blockchain and contains the information required to move the contract
 * forward via computeTransaction
 * @see Section 2.1.8 and appendix E.14 of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe spec}
 * @category State
 */
export interface MarloweState {
  /**
   * @inheritdoc Accounts
   */
  accounts: Accounts;
  /**
   * This is a Map of the values that were bound to the contract using the {@link Let} construct.
   */
  boundValues: AssocMap<ValueId, bigint>;
  /**
   * This is a Map of the choices that were made by the participants of the contract using the {@link Choice} action.
   */
  choices: AssocMap<ChoiceId, bigint>;
  /**
   * Transactions have a validity time interval `(startTime, endTime)` which gives us a proxy for real time.
   * It is up to the blockchain implementation to make sure that `startTime <= now <= endTime`. The variable
   * `minTime` is the biggest known `startTime`. That allow us to trim a time interval and ensure that
   * `startTime` does not decrease between transactions.
   */
  minTime: bigint;
}
/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link MarloweState | state type}.
 * @see Section 2.1.8 and appendix E.14 of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe spec}
 * @category State
 */
export const MarloweStateGuard: t.Type<MarloweState> = t.type({
  accounts: AccountsGuard,
  boundValues: AssocMapGuard(ValueIdGuard, t.bigint),
  choices: AssocMapGuard(ChoiceIdGuard, t.bigint),
  minTime: t.bigint,
});
