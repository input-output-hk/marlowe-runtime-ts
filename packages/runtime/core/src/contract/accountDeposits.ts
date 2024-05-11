import * as t from "io-ts/lib/index.js";
import { Party, partyToString } from "@marlowe.io/language-core-v1";
import { Assets, AssetsMap, AssetsMapGuard, mapAsset } from "../asset/index.js";

export type AddressOrRole = string;
export const AddressOrRoleGuard = t.string;
/**
 * A map of tags to their content. The key is a string, the value can be anything.
 */
export type AccountDeposits = { [key in AddressOrRole]: AssetsMap };
/**
 * @hidden
 */
export const AccountDepositsGuard = t.record(AddressOrRoleGuard, AssetsMapGuard);
/**
 * a function that takes a list of party with associated assets and returns an accountDeposits
 * the party object is converted to a string using partyToString.
 * @param accounts
 * @returns
 */
export function mkaccountDeposits(accounts: [Party, Assets][]): AccountDeposits {
  return Object.fromEntries(accounts.map(([party, assets]) => [partyToString(party), mapAsset(assets)]));
}
