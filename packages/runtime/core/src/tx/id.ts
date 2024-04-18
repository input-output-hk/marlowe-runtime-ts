import { unsafeEither } from "@marlowe.io/adapter/fp-ts";
import * as t from "io-ts/lib/index.js";

export interface TxIdBrand {
  readonly TxId: unique symbol;
}

/**
 * Cardano transaction identifier.
 *
 * @remarks The underlying data structure is a normal string, but in the type
 * level it is **Branded** with a unique symbol so that it is not confused with other strings
 */
export type TxId = t.Branded<string, TxIdBrand>;

export const TxIdGuard = t.brand(t.string, (s): s is t.Branded<string, TxIdBrand> => true, "TxId");

export const txId = (s: string) => unsafeEither(TxIdGuard.decode(s));
