import * as t from "io-ts/lib/index.js";
import { unsafeEither } from "@marlowe.io/adapter/fp-ts";
import { preservedBrand } from "@marlowe.io/adapter/io-ts";

export interface RuntimeVersionBrand {
  readonly RuntimeVersion: unique symbol;
}

export const RuntimeVersionGuard = preservedBrand(
  t.string,
  (s): s is t.Branded<string, RuntimeVersionBrand> => true,
  "RuntimeVersion"
);

export type RuntimeVersion = t.TypeOf<typeof RuntimeVersionGuard>;

export const runtimeVersion = (s: string) => unsafeEither(RuntimeVersionGuard.decode(s));

export type CompatibleRuntimeVersion = "0.0.6" | "0.0.5";

export const CompatibleRuntimeVersionGuard: t.Type<CompatibleRuntimeVersion, string> = t.union([
  t.literal("0.0.6"),
  t.literal("0.0.5"),
]);
