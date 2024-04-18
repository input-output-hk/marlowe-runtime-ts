import * as t from "io-ts/lib/index.js";
import * as T from "./token.js";

/**
 * search [[token-vs-token_value]]
 * @hidden
 */
export const toString: (token: TokenValue) => string = (tokenValue) =>
  `${tokenValue.amount} - ${T.tokenToString(tokenValue.token)}`;

/**
 * search [[token-vs-token_value]]
 * @hidden
 */
export type TokenValue = t.TypeOf<typeof TokenValue>;
/**
 * search [[token-vs-token_value]]
 * @hidden
 */
export const TokenValue = t.type({ amount: t.bigint, token: T.TokenGuard });
/**
 * search [[token-vs-token_value]]
 * @hidden
 */
export const tokenValue: (amount: bigint) => (token: T.Token) => TokenValue = (amount) => (token) => ({
  amount: amount,
  token: token,
});

/**
 * search [[token-vs-token_value]]
 * @hidden
 */
export const lovelaceValue: (lovelaces: bigint) => TokenValue = (lovelaces) => ({
  amount: lovelaces,
  token: T.adaToken,
});

/**
 * search [[token-vs-token_value]]
 * @hidden
 */
export const adaValue: (adaAmount: bigint) => TokenValue = (adaAmount) => ({
  amount: adaAmount * 1_000_000n,
  token: T.adaToken,
});
