import * as TE from "fp-ts/lib/TaskEither.js";
import * as E from "fp-ts/lib/Either.js";

import "@relmify/jest-fp-ts";
import { pipe } from "fp-ts/lib/function.js";
import { formatValidationErrors } from "jsonbigint-io-ts-reporters";
import { Contract } from "@marlowe.io/language-core-v1/guards";
import * as path from "path";
import { fileURLToPath } from "url";
import { MarloweJSONCodec, minify } from "@marlowe.io/adapter/codec";
import { getFileContents } from "@marlowe.io/adapter/file";

const getfilename = () => fileURLToPath(import.meta.url);
export const currentDirectoryPath = () => path.dirname(getfilename());

describe("contract", () => {
  it.each(["close", "when", "pay", "let"])("(%p) can be decoded/encoded and is isomorphic", async (filename) => {
    await pipe(
      TE.Do,
      TE.bind("uncoded", () => getFileContents(path.join(currentDirectoryPath(), `/jsons/${filename}.json`))),
      TE.bind("decoded", ({ uncoded }) => TE.of(MarloweJSONCodec.decode(uncoded))),
      TE.bindW("typed", ({ decoded }) =>
        TE.fromEither(pipe(Contract.decode(decoded), E.mapLeft(formatValidationErrors)))
      ),
      TE.bindW("encoded", ({ typed }) => TE.of(MarloweJSONCodec.encode(typed))),
      TE.match(
        (e) => {
          console.dir(e, { depth: null });
          expect(e).not.toBeDefined();
        },
        ({ encoded, uncoded }) => {
          expect(minify(encoded)).toEqual(minify(uncoded));
        }
      )
    )();
  });
});
