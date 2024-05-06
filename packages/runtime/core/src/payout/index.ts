import * as t from "io-ts/lib/index.js";
import { iso, Newtype } from "newtype-ts";
import { fromNewtype } from "io-ts-types";
import { split } from "fp-ts/lib/string.js";
import { pipe } from "fp-ts/lib/function.js";
import { head } from "fp-ts/lib/ReadonlyNonEmptyArray.js";
import { txId, TxId } from "../tx/id.js";
import { ContractIdGuard } from "../contract/id.js";
import { AssetId, Assets, AssetsGuard } from "../asset/index.js";

// QUESTION: @N.H: What is the difference between PayoutId and WithdrawalId?
export type PayoutId = Newtype<{ readonly ContractId: unique symbol }, string>;
export const PayoutId = fromNewtype<PayoutId>(t.string);
export const unPayoutId = iso<PayoutId>().unwrap;
export const payoutId = iso<PayoutId>().wrap;

export const payoutIdToTxId: (payoutId: PayoutId) => TxId = (payoutId) =>
  pipe(payoutId, unPayoutId, split("#"), head, txId);

export type WithdrawalId = Newtype<{ readonly WithdrawalId: unique symbol }, string>;
export const WithdrawalId = fromNewtype<WithdrawalId>(t.string);
export const unWithdrawalId = iso<WithdrawalId>().unwrap;
export const withdrawalId = iso<WithdrawalId>().wrap;

export const withdrawalIdToTxId: (withdrawalId: WithdrawalId) => TxId = (withdrawalId) =>
  pipe(withdrawalId, unWithdrawalId, txId);

// DISCUSSION: PayoutAvailable or AvailablePayout?
export type PayoutAvailable = t.TypeOf<typeof PayoutAvailable>;
export const PayoutAvailable = t.type({
  payoutId: PayoutId,
  contractId: ContractIdGuard,
  role: AssetId,
  assets: AssetsGuard,
});

export type PayoutWithdrawn = t.TypeOf<typeof PayoutWithdrawn>;
export const PayoutWithdrawn = t.type({
  withdrawalId: WithdrawalId,
  payoutId: PayoutId,
  contractId: ContractIdGuard,
  role: AssetId,
  assets: AssetsGuard,
});
