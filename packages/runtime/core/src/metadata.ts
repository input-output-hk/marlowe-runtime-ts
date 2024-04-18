/**
 * This module contains the static types and the dynamic guards for the metadata that can be attached to a transaction.
 */
import { BigIntOrNumber, BigIntOrNumberGuard } from "@marlowe.io/adapter/bigint";
import { preservedBrand } from "@marlowe.io/adapter/io-ts";
import * as t from "io-ts/lib/index.js";

/**
 * This branded type represents a string that is a valid number.
 * "1" is a valid NumberLikeString, "a" is not.
 */
export interface NumberLikeStringBrand {
  readonly NumberLikeString: unique symbol;
}

export const NumberLikeStringGuard = preservedBrand(
  t.string,
  (s): s is t.Branded<string, NumberLikeStringBrand> => !Number.isNaN(Number(s)),
  "NumberLikeString"
);
export type NumberLikeString = t.TypeOf<typeof NumberLikeStringGuard>;

/**
 * This branded type represents a string that has 64 or less characters.
 */
export interface StringUnder64Brand {
  readonly StringUnder64: unique symbol;
}
export const StringUnder64Guard = preservedBrand(
  t.string,
  (s): s is t.Branded<string, StringUnder64Brand> => s.length <= 64,
  "StringUnder64"
);
export type StringUnder64 = t.TypeOf<typeof StringUnder64Guard>;

export type MetadatumLabel = t.TypeOf<typeof MetadatumLabelGuard>;
export const MetadatumLabelGuard = t.union([t.number, StringUnder64Guard]);

export type MetadatumRecord = { [Key: StringUnder64 | number]: Metadatum };
export const MetadatumRecordGuard: t.Type<MetadatumRecord> = t.recursion("MetadatumRecord", () =>
  t.record(MetadatumLabelGuard, MetadatumGuard)
);

export type MetadatumArray = Array<Metadatum>;
export const MetadatumArrayGuard: t.Type<MetadatumArray> = t.recursion("MetadatumArray", () => t.array(MetadatumGuard));

export type Metadatum = BigIntOrNumber | StringUnder64 | MetadatumArray | MetadatumRecord;

export const MetadatumGuard: t.Type<Metadatum> = t.recursion("Metadatum", () =>
  t.union([BigIntOrNumberGuard, StringUnder64Guard, MetadatumArrayGuard, MetadatumRecordGuard])
);

// The top level Metadatum record requires its keys to be either numbers or strings
// that can be coerced into a number
export type MetadatumTopLevelLabel = t.TypeOf<typeof MetadatumTopLevelLabelGuard>;
export const MetadatumTopLevelLabelGuard = t.union([t.number, NumberLikeStringGuard]);

export interface Metadata {
  [key: MetadatumTopLevelLabel]: Metadatum;
}

export const MetadataGuard: t.Type<Metadata> = t.record(MetadatumTopLevelLabelGuard, MetadatumGuard);
