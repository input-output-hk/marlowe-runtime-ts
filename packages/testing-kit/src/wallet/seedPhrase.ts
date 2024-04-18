import { unsafeEither } from "@marlowe.io/adapter/fp-ts";
import * as t from "io-ts/lib/index.js";
import { generateMnemonic } from "bip39";

export interface SeedPhraseBrand {
  readonly SeedPhrase: unique symbol;
}

export const SeedPhraseGuard = t.brand(
  t.array(t.string),
  (s): s is t.Branded<string[], SeedPhraseBrand> => true,
  "SeedPhrase"
);

export type SeedPhrase = t.TypeOf<typeof SeedPhraseGuard>;

export const seedPhrase = (s: string[]) => unsafeEither(SeedPhraseGuard.decode(s));

export type SeedSize = "15-words" | "24-words";

export const generateSeedPhrase = (strength: SeedSize): SeedPhrase => {
  switch (strength) {
    case "15-words":
      return seedPhrase(generateMnemonic(160).split(" "));
    case "24-words":
      return seedPhrase(generateMnemonic(256).split(" "));
  }
};
