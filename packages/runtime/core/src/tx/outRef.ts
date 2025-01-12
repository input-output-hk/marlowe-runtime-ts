import * as t from "io-ts/lib/index.js";
import { iso, Newtype } from "newtype-ts";
import { fromNewtype } from "io-ts-types";
/**
 * A reference to a transaction output.
 */
// FIXME: This should be turned into a TxId and TxIx pair
export type TxOutRef = Newtype<{ readonly TxOutRef: unique symbol }, string>;
export const TxOutRef = fromNewtype<TxOutRef>(t.string);
export const unTxOutRef = iso<TxOutRef>().unwrap;
export const txOutRef = iso<TxOutRef>().wrap;

// FIXME: These should return TxId and TxIx
export const getTxId = (txOutRef: TxOutRef): string => unTxOutRef(txOutRef).split("#")[0];
export const getTxIx = (txOutRef: TxOutRef): number => parseInt(unTxOutRef(txOutRef).split("#")[1]);
