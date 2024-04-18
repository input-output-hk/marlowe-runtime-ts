import * as t from "io-ts/lib/index.js";
import { iso, Newtype } from "newtype-ts";
import { fromNewtype } from "io-ts-types";
import { TxOutRef } from "./tx/outRef.js";
import { unsafeEither } from "@marlowe.io/adapter/fp-ts";
// TODO: Try to use a lighter library than lucid for checking this.
import { C } from "lucid-cardano";
import { preservedBrand } from "@marlowe.io/adapter/io-ts";

export interface AddressBech32Brand {
  readonly AddressBech32: unique symbol;
}

export const AddressBech32Guard = preservedBrand(
  t.string,
  (s): s is t.Branded<string, AddressBech32Brand> => {
    try {
      // TODO: Try to use a lighter library than lucid for checking this.
      C.Address.from_bech32(s);
      return true;
    } catch (e) {
      return false;
    }
  },
  "AddressBech32"
);

export type AddressBech32 = t.TypeOf<typeof AddressBech32Guard>;

export const addressBech32 = (s: string) => unsafeEither(AddressBech32Guard.decode(s));

export type AddressesAndCollaterals = t.TypeOf<typeof AddressesAndCollaterals>;
export const AddressesAndCollaterals = t.type({
  changeAddress: AddressBech32Guard,
  usedAddresses: t.array(AddressBech32Guard),
  collateralUTxOs: t.array(TxOutRef),
});

export type StakeAddressBech32 = Newtype<{ readonly StakeAddressBech32: unique symbol }, string>;
export const StakeAddressBech32 = fromNewtype<StakeAddressBech32>(t.string);
export const unStakeAddressBech32 = iso<StakeAddressBech32>().unwrap;
export const stakeAddressBech32 = iso<StakeAddressBech32>().wrap;
