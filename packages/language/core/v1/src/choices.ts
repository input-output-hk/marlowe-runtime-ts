import { Sort, strCmp } from "@marlowe.io/adapter/assoc-map";
import * as t from "io-ts/lib/index.js";
import { Party, partyCmp, PartyGuard } from "./participants.js";

/**
 * Represents a choice topic.
 * @category Choice
 */
export type ChoiceName = string;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link @marlowe.io/language-core-v1!index.ChoiceName | choice name type}.
 * @category Choice
 */
export const ChoiceNameGuard: t.Type<ChoiceName> = t.string;

/**
 * Identifier for a  {@link @marlowe.io/language-core-v1!index.Choice | choice}.
 * @category Choice
 */
export interface ChoiceId {
  choice_name: ChoiceName;
  choice_owner: Party;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link @marlowe.io/language-core-v1!index.ChoiceId | choice id type}.
 * @category Choice
 */
export const ChoiceIdGuard: t.Type<ChoiceId> = t.type({
  choice_name: ChoiceNameGuard,
  choice_owner: PartyGuard,
});

/**
 * Sorting function for ChoiceId as defined in the Marlowe Specification (SemanticsGuarantees.thy)
 * @hidden
 */
export function choiceIdCmp(a: ChoiceId, b: ChoiceId): Sort {
  const nameCmp = strCmp(a.choice_name, b.choice_name);
  if (nameCmp !== "EqualTo") {
    return nameCmp;
  }
  return partyCmp(a.choice_owner, b.choice_owner);
}

/**
 * Marlowe {@link @marlowe.io/language-core-v1!index.Choice | choices} are numeric values that
 * are bounded with the inclusive interval `[from , to]`.
 * @category Choice
 */
export interface Bound {
  from: bigint;
  to: bigint;
}

// TODO: Try to remove recursion
/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link @marlowe.io/language-core-v1!index.Bound | bound type}.
 * @category Choice
 */
export const BoundGuard: t.Type<Bound> = t.recursion("Bound", () => t.type({ from: t.bigint, to: t.bigint }));

/**
 * Represents a value that was chosen by a party in a {@link @marlowe.io/language-core-v1!index.IChoice | choice input}
 * @category Choice
 */
export type ChosenNum = bigint;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link @marlowe.io/language-core-v1!index.ChosenNum | chosen num type}.
 * @category Choice
 */
export const ChosenNumGuard: t.Type<ChosenNum> = t.bigint;

/**
 * Checks if a chosen number is between a given bound
 * @category Choice
 */
export function inBound(num: bigint, bound: Bound): boolean {
  return num >= bound.from && num <= bound.to;
}

/**
 * Checks if a chosen number is within any of the given bounds
 * @category Choice
 */
export function inBounds(num: bigint, bounds: Bound[]): boolean {
  return bounds.some((bound) => inBound(num, bound));
}
