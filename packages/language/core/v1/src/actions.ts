import * as t from "io-ts/lib/index.js";

import { Observation, ObservationGuard, Value } from "./value-and-observation.js";
import { ChoiceId, ChoiceIdGuard } from "./choices.js";
import { Party, PartyGuard } from "./participants.js";
import { AccountId, AccountIdGuard } from "./payee.js";
import { Token, TokenGuard } from "./token.js";
import { ValueGuard } from "./value-and-observation.js";
import { Bound, BoundGuard } from "./choices.js";

/**
 * TODO: Comment
 * @category Action
 */
export interface Choice {
  choose_between: Bound[];
  for_choice: ChoiceId;
}

// TODO: Try to remove recursion
/**
 * TODO: Comment
 * @category Action
 */
export const ChoiceGuard: t.Type<Choice> = t.recursion("Choice", () =>
  t.type({ choose_between: t.array(BoundGuard), for_choice: ChoiceIdGuard })
);

/**
 * TODO: Comment
 * @category Action
 */
export interface Deposit {
  party: Party;
  deposits: Value;
  of_token: Token;
  into_account: AccountId;
}

/**
 * TODO: Comment
 * @category Action
 */
export const DepositGuard: t.Type<Deposit> = t.type({
  party: PartyGuard,
  deposits: ValueGuard,
  of_token: TokenGuard,
  into_account: AccountIdGuard,
});

/**
 * TODO: Comment
 * @category Action
 */
export interface Notify {
  notify_if: Observation;
}

/**
 * TODO: Comment
 * @category Action
 */
export const NotifyGuard: t.Type<Notify> = t.recursion("Notify", () => t.type({ notify_if: ObservationGuard }));

/**
 * TODO: Comment
 * @category Action
 */
export type Action = Deposit | Choice | Notify;

/**
 * TODO: Comment
 * @category Action
 */
export const ActionGuard: t.Type<Action> = t.recursion("Action", () =>
  t.union([DepositGuard, ChoiceGuard, NotifyGuard])
);
