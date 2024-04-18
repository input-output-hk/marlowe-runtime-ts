import * as t from "io-ts/lib/index.js";
import { PartyGuard, Party } from "./participants.js";

/**
 * The Marlowe model allows for a contract to store assets. All participants of the contract
 * implicitly own an account identified with an AccountId. Which is just a type alias for
 * a Party.
 * @category Payee
 */
export type AccountId = Party;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link AccountId | accountId type}.
 * @category Payee
 */
export const AccountIdGuard = PartyGuard;

// DISCUSSION: [[ payee-name-conflict ]]
//   The internal types for a Payee are named differently than other types because
//   there is a name conflict between the Party Constructor and the Party type.
//   The Party type is defined in the participants module and has Address and Role
//   as constructors. The Party constructor is defined here in the Payee module.
//   In Haskell/PureScript this conflict doesn't matter as they live in different
//   namespaces, but for typescript we need to avoid collision, so I've added a Payee
//   prefix.
//   Eventually it would be ideal to rename Account to Internal and Party to External
//   to better indicate the intent of a Payout. But this should be done as a single effort
//   all acrross the codebase.

/**
 * One of the {@link @marlowe.io/language-core-v1!index.Payee} options. A payment made to
 * an Account payee is an internal transfer of the funds (it doesn't leave the contract).
 * @category Payee
 */
// see [[ payee-name-conflict ]]
export interface PayeeAccount {
  account: AccountId;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link @marlowe.io/language-core-v1!index.PayeeAccount | account payee type}.
 * @category Payee
 */
// see [[ payee-name-conflict ]]
export const PayeeAccountGuard = t.type({
  account: AccountIdGuard,
});

/**
 * One of the {@link @marlowe.io/language-core-v1!index.Payee} options. A payment made to
 * a Party payee takes the money out of the contract and gives it to the party.
 * @category Payee
 */
// see [[ payee-name-conflict ]]
export interface PayeeParty {
  party: Party;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link @marlowe.io/language-core-v1!index.PayeeParty | party payee type}.
 * @category Payee
 */
// see [[ payee-name-conflict ]]
export const PayeePartyGuard = t.type({
  party: PartyGuard,
});

/**
 * When you use the {@link @marlowe.io/language-core-v1!index.Pay | Pay} construct to make a
 * {@link @marlowe.io/language-core-v1!semantics.Payment | payment} you need to specify the destination
 * of the payment using a `Payee`.
 * @category Payee
 */
// see [[ payee-name-conflict ]]
export type Payee = PayeeAccount | PayeeParty;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link @marlowe.io/language-core-v1!index.Payee | payee type}.
 * @category Payee
 */
// see [[ payee-name-conflict ]]
export const PayeeGuard = t.union([PayeeAccountGuard, PayeePartyGuard]);

/**
 * Pattern match object on the Payee type
 * @category Payee
 * @hidden
 */
export type PayeeMatcher<T> = {
  party: (party: Party) => T;
  account: (account: AccountId) => T;
};

/**
 * Pattern matching on the Payee type
 * @hidden
 * @category Payee
 */
export function matchPayee<T>(matcher: PayeeMatcher<T>): (payee: Payee) => T;
export function matchPayee<T>(matcher: Partial<PayeeMatcher<T>>): (payee: Payee) => T | undefined;
export function matchPayee<T>(matcher: Partial<PayeeMatcher<T>>) {
  return (payee: Payee) => {
    if (PayeePartyGuard.is(payee) && matcher.party) {
      return matcher.party(payee.party);
    } else if (PayeeAccountGuard.is(payee) && matcher.account) {
      return matcher.account(payee.account);
    }
  };
}
