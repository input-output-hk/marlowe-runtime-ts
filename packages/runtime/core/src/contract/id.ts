import * as t from "io-ts/lib/index.js";
import { split } from "fp-ts/lib/string.js";
import { pipe } from "fp-ts/lib/function.js";
import { head } from "fp-ts/lib/ReadonlyNonEmptyArray.js";
import { TxId, txId } from "../tx/id.js";
import { unsafeEither } from "@marlowe.io/adapter/fp-ts";
import { preservedBrand } from "@marlowe.io/adapter/io-ts";

export interface ContractIdBrand {
  readonly ContractId: unique symbol;
}

export const ContractIdGuard = preservedBrand(
  t.string,
  (s): s is t.Branded<string, ContractIdBrand> => true,
  "ContractId"
);

/**
 * Marlowe contract identifier.
 *
 * @remarks The underlying data structure is a normal string, but in the type
 * level it is **Branded** with a unique symbol so that it is not confused with other strings
 */
export type ContractId = t.Branded<string, ContractIdBrand>;

export const contractId = (s: string) => unsafeEither(ContractIdGuard.decode(s));

export const contractIdToTxId: (contractId: ContractId) => TxId = (contractId) =>
  pipe(contractId, split("#"), head, txId);
