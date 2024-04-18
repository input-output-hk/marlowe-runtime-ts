import * as TE from "fp-ts/lib/TaskEither.js";
import * as E from "fp-ts/lib/Either.js";

import fs from "fs";
import { promisify } from "util";

const readFromFile = promisify(fs.readFile);
export const getFileContents = (path: string) => TE.tryCatch(() => readFromFile(path, "utf-8"), E.toError);
