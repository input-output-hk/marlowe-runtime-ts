/**
 * This module defines the participant types as defined in the Marlowe Specification.
 * @see Section 2.1.1 of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/specification-v3.pdf | Marlowe Specification}
 * @packageDocumentation
 */
import * as t from "io-ts/lib/index.js";
import { pipe } from "fp-ts/lib/function.js";
import * as A from "fp-ts/lib/Array.js";

import { AddressBech32 } from "./address.js";
import { Sort, strCmp } from "@marlowe.io/adapter/assoc-map";

/**
 *
 * An address party is defined by a blockchain specific Address and it cannot be traded
 * (it is fixed for the lifetime of a contract).
  ```
  const addressExample: Address = {"address" : "addr_test1qpcucug827nlrmsv7n66hwdfpemwqtv8nxnjc4azacuu807w6l6hgelwsph7clqmauq7h3y9qhhgs0rwu3mu8uf7m4kqckxkry"}
  ```
 * @see Section 2.1.1 and appendix E.1 of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe specification}
 * @category Party
 */
export interface Address {
  address: AddressBech32;
}
/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Address | address type}.
 * @category Party
 */
export const AddressGuard: t.Type<Address> = t.type({ address: AddressBech32 });

/**
 * Type alias for the role name.
 * @category Party
 */
export type RoleName = string;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link RoleName | role name type}.
 * @category Party
 */
export const RoleNameGuard: t.Type<RoleName> = t.string;

/**
 * Search [[lower-name-builders]]
 * @hidden
 */
export const role = (roleToken: RoleName) => ({ role_token: roleToken });

/**
 * A Role, allows the participation of the contract to be dynamic. Any user that can prove to have permission to act as `RoleName` is able to carry out the
 * {@link  @marlowe.io/language-core-v1!index.Action | actions} assigned, and redeem the {@link  @marlowe.io/language-core-v1!semantics.Payment | payments} issued to that role.
 * The roles are implemented as tokens that can be traded, this allows for more complex use cases.
 *
  ```
  const roleExample: Role = {"role_token" : "Buyer"}
  ```
 * @category Party
 */
export interface Role {
  role_token: RoleName;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Role | role type}.
 * @category Party
 */
export const RoleGuard: t.Type<Role> = t.type({ role_token: RoleNameGuard });

/**
 * Search [[lower-name-builders]]
 * @hidden
 */
export const party = (party: Role | Address) => party;

/**
 * A participant (or `Party`) in the contract can be represented by either a fixed {@link Address}
 * or a {@link Role}
 * @category Party
 */
export type Party = Address | Role;
/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Party | party type}.
 * @category Party
 */
export const PartyGuard = t.union([AddressGuard, RoleGuard]);

/**
 * @hidden
 */
export const partiesToStrings: (parties: Party[]) => string[] = (parties) => pipe(parties, A.map(partyToString));

/**
 * @hidden
 */
export const partyToString: (party: Party) => string = (party) =>
  RoleGuard.is(party) ? party.role_token : party.address;

/**
 * Sorting function for Parties as defined in the Marlowe Specification (SemanticsGuarantees.thy)
 * @hidden
 */
export function partyCmp(a: Party, b: Party): Sort {
  if (AddressGuard.is(a) && RoleGuard.is(b)) {
    return "LowerThan";
  }
  if (RoleGuard.is(a) && AddressGuard.is(b)) {
    return "GreaterThan";
  }
  if (AddressGuard.is(a) && AddressGuard.is(b)) {
    return strCmp(a.address, b.address);
  }
  if (RoleGuard.is(a) && RoleGuard.is(b)) {
    return strCmp(a.role_token, b.role_token);
  }
  throw new Error("Unreachable");
}
