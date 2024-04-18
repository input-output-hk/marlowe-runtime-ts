import * as t from "io-ts/lib/index.js";
import * as G from "@marlowe.io/language-core-v1/guards";
import { Token as CoreToken, lovelace, TokenName } from "@marlowe.io/language-core-v1";
import { Reference, ReferenceGuard } from "./reference.js";

export { CoreToken, lovelace, TokenName };

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.Token | Core Token} with
 * the ability to reference other tokens.
 * @category Token
 */
export type Token = CoreToken | Reference;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Token | token type}.
 * @category Token
 */
export const TokenGuard = t.union([G.Token, ReferenceGuard]);
