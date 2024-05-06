import * as t from "io-ts/lib/index.js";
import { PolicyId, PolicyIdGuard, policyId } from "../policyId.js";

import * as Marlowe from "@marlowe.io/language-core-v1";
import * as G from "@marlowe.io/language-core-v1/guards";
import { assertGuardEqual, proxy, convertNullableToUndefined } from "@marlowe.io/adapter/io-ts";

export type AssetName = t.TypeOf<typeof AssetName>;
export const AssetName = t.string;

export type AssetQuantity = t.TypeOf<typeof AssetQuantityGuard>;
export const AssetQuantityGuard = t.bigint;

export type AssetId = t.TypeOf<typeof AssetId>;
export const AssetId = t.type({
  policyId: PolicyIdGuard,
  assetName: AssetName,
});

export const assetId =
  (policyId: PolicyId) =>
  (assetName: AssetName): AssetId => ({
    policyId: policyId,
    assetName: assetName,
  });

export const isLovelace = (assetId: AssetId): boolean => assetId.assetName === "" && assetId.policyId === policyId("");

// NOTE: this is exported as interface to prevent typedoc from expanding its attributes when
//       generating documentation.
//       https://github.com/TypeStrong/typedoc/issues/2209#issuecomment-1493189988
export interface Token extends t.TypeOf<typeof Token> {}
export const Token = t.type({ quantity: AssetQuantityGuard, assetId: AssetId });

export const token =
  (quantity: AssetQuantity) =>
  (assetId: AssetId): Token => ({ quantity: quantity, assetId: assetId });

export const lovelaces = (quantity: AssetQuantity): Token => token(quantity)(assetId(policyId(""))(""));

export type Tokens = Token[];
export const TokensGuard = assertGuardEqual(proxy<Tokens>(), t.array(Token));

export type Assets = {
  lovelaces?: AssetQuantity;
  tokens: Tokens;
};

export const AssetsGuard = assertGuardEqual(
  proxy<Assets>(),
  t.intersection([
    t.type({
      tokens: TokensGuard,
    }),
    t.partial({
      lovelaces: convertNullableToUndefined(AssetQuantityGuard),
    }),
  ])
);

export const assetIdToString: (assetId: AssetId) => string = (assetId) => `${assetId.policyId}|${assetId.assetName}`;

export const runtimeTokenToMarloweTokenValue: (runtimeToken: Token) => Marlowe.TokenValue = (runtimeToken) => ({
  amount: runtimeToken.quantity,
  token: {
    currency_symbol: runtimeToken.assetId.policyId,
    token_name: runtimeToken.assetId.assetName,
  },
});

export type TokensMap = t.TypeOf<typeof TokensMapGuard>;
export const TokensMapGuard = t.record(PolicyIdGuard, t.record(G.TokenName, AssetQuantityGuard));

export type AssetsMap = t.TypeOf<typeof AssetsMapGuard>;
export const AssetsMapGuard = t.type({
  lovelace: AssetQuantityGuard,
  tokens: TokensMapGuard,
});

export const unMapAsset: (assets: AssetsMap) => Assets = (restAssets) => ({
  lovelaces: restAssets.lovelace,
  tokens: unMapTokens(restAssets.tokens),
});

export const mapAsset: (assets: Assets) => AssetsMap = (assets) => ({
  lovelace: assets.lovelaces ?? 0n,
  tokens: mapTokens(assets.tokens),
});

export const mapTokens: (tokens: Tokens) => TokensMap = (tokens) =>
  tokens.reduce((acc, token) => {
    const policyId = token.assetId.policyId;
    const assetName = token.assetId.assetName;
    const quantity = token.quantity;
    if (acc[policyId] === undefined) {
      acc[policyId] = {};
    }
    acc[policyId][assetName] = quantity;
    return acc;
  }, {} as TokensMap);

export const unMapTokens: (tokens: TokensMap) => Tokens = (restTokens) =>
  Object.entries(restTokens)
    .map(([aPolicyId, x]) =>
      Object.entries(x).map(([assetName, quantity]) => token(quantity)(assetId(policyId(aPolicyId))(assetName)))
    )
    .flat();
