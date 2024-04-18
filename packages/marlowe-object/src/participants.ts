import * as t from "io-ts/lib/index.js";
import { Address, Role } from "@marlowe.io/language-core-v1";
import * as G from "@marlowe.io/language-core-v1/guards";
import { Reference, ReferenceGuard } from "./reference.js";

export { Address, Role };

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.Party | Core Party} with
 * the ability to reference other parties.
 * @category Party
 */
export type Party = Address | Role | Reference;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Party | party type}.
 * @category Party
 */
export const PartyGuard = t.union([G.Address, G.Role, ReferenceGuard]);

/**
 * Pattern match object on the Party type
 * @category Party
 * @hidden
 */
export type PartyMatcher<T> = {
  address: (party: Address) => T;
  role: (party: Role) => T;
  reference: (party: Reference) => T;
};

/**
 * Pattern matching on the Party type
 * @hidden
 * @category Party
 */
export function matchParty<T>(matcher: PartyMatcher<T>): (party: Party) => T;
export function matchParty<T>(matcher: Partial<PartyMatcher<T>>): (party: Party) => T | undefined;
export function matchParty<T>(matcher: Partial<PartyMatcher<T>>) {
  return (party: Party) => {
    if (G.Address.is(party) && matcher.address) {
      return matcher.address(party);
    } else if (G.Role.is(party) && matcher.role) {
      return matcher.role(party);
    } else if (ReferenceGuard.is(party) && matcher.reference) {
      return matcher.reference(party);
    }
  };
}
