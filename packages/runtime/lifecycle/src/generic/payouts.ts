import * as TE from "fp-ts/lib/TaskEither.js";
import { constVoid, pipe } from "fp-ts/lib/function.js";
import * as O from "fp-ts/lib/Option.js";
import { tryCatchDefault, unsafeTaskEither } from "@marlowe.io/adapter/fp-ts";
import { Filters, PayoutsDI, PayoutsAPI } from "../api.js";
import { getAddressesAndCollaterals, WalletAPI } from "@marlowe.io/wallet/api";
import {
  PayoutId,
  PayoutAvailable,
  AssetId,
  PayoutWithdrawn,
  withdrawalIdToTxId,
  unMapAsset,
} from "@marlowe.io/runtime-core";

import { FPTSRestAPI, RestClient } from "@marlowe.io/runtime-rest-client";

import { DecodingError } from "@marlowe.io/adapter/codec";
import { stringify } from "json-bigint";

export function mkPayoutLifecycle(
  wallet: WalletAPI,
  deprecatedRestAPI: FPTSRestAPI,
  restClient: RestClient
): PayoutsAPI {
  const di = { wallet, deprecatedRestAPI, restClient };
  return {
    available: fetchAvailablePayouts(di),
    withdraw: withdrawPayouts(di),
    withdrawn: fetchWithdrawnPayouts(di),
  };
}

const fetchAvailablePayouts =
  ({ wallet, deprecatedRestAPI }: PayoutsDI) =>
  (filters?: Filters): Promise<PayoutAvailable[]> => {
    return unsafeTaskEither(fetchAvailablePayoutsFpTs(deprecatedRestAPI)(wallet)(O.fromNullable(filters)));
  };
const withdrawPayouts =
  ({ wallet, deprecatedRestAPI }: PayoutsDI) =>
  (payoutIds: PayoutId[]): Promise<void> => {
    return unsafeTaskEither(withdrawPayoutsFpTs(deprecatedRestAPI)(wallet)(payoutIds));
  };
const fetchWithdrawnPayouts =
  ({ wallet, deprecatedRestAPI }: PayoutsDI) =>
  (filters?: Filters): Promise<PayoutWithdrawn[]> => {
    return unsafeTaskEither(fetchWithdrawnPayoutsFpTs(deprecatedRestAPI)(wallet)(O.fromNullable(filters)));
  };

const fetchAvailablePayoutsFpTs: (
  restAPI: FPTSRestAPI
) => (
  walletApi: WalletAPI
) => (filtersOption: O.Option<Filters>) => TE.TaskEither<Error | DecodingError, PayoutAvailable[]> =
  (restAPI) => (walletApi) => (filtersOption) =>
    pipe(
      getAssetIds(walletApi),
      TE.chain((walletAssetIds) =>
        pipe(
          restAPI.payouts.getHeadersByRange()(
            pipe(
              filtersOption,
              O.match(
                () => [],
                (filters) => filters.byContractIds
              )
            )
          )(
            pipe(
              filtersOption,
              O.match(
                () => walletAssetIds,
                (filters) => filters.byMyRoleTokens(walletAssetIds)
              )
            )
          )(O.some("available")),
          TE.map((result) => result.payouts)
        )
      ),
      TE.chain((payouts) => TE.sequenceArray(payouts.map((payout) => restAPI.payouts.get(payout.payoutId)))),
      TE.map((payoutsDetails) =>
        payoutsDetails.map((payoutDetails) => ({
          payoutId: payoutDetails.payoutId,
          contractId: payoutDetails.contractId,
          role: payoutDetails.role,
          assets: unMapAsset(payoutDetails.assets),
        }))
      )
    );

const fetchWithdrawnPayoutsFpTs: (
  restAPI: FPTSRestAPI
) => (
  walletApi: WalletAPI
) => (filtersOption: O.Option<Filters>) => TE.TaskEither<Error | DecodingError, PayoutWithdrawn[]> =
  (restAPI) => (walletApi) => (filtersOption) =>
    pipe(
      getAssetIds(walletApi),
      TE.chain((walletAssetIds) =>
        pipe(
          restAPI.payouts.getHeadersByRange()(
            pipe(
              filtersOption,
              O.match(
                () => [],
                (filters) => filters.byContractIds
              )
            )
          )(
            pipe(
              filtersOption,
              O.match(
                () => walletAssetIds,
                (filters) => filters.byMyRoleTokens(walletAssetIds)
              )
            )
          )(O.some("withdrawn")),
          TE.map((result) => result.payouts)
        )
      ),
      TE.chain((payouts) => TE.sequenceArray(payouts.map((payout) => restAPI.payouts.get(payout.payoutId)))),
      TE.map((payoutsDetails) =>
        payoutsDetails.map((payoutDetails) =>
          pipe(
            payoutDetails.withdrawalId,
            O.match(
              () => {
                throw `Rest API Inconsistencies for Payout API (payout withdrawn without a withdrawalID) : ${stringify(
                  payoutDetails
                )}`;
              },
              (withdrawalId) => ({
                withdrawalId: withdrawalId,
                payoutId: payoutDetails.payoutId,
                contractId: payoutDetails.contractId,
                role: payoutDetails.role,
                assets: unMapAsset(payoutDetails.assets),
              })
            )
          )
        )
      )
    );

const getAssetIds: (walletApi: WalletAPI) => TE.TaskEither<Error, AssetId[]> = (walletAPI) =>
  pipe(
    tryCatchDefault(walletAPI.getTokens),
    TE.map((tokens) => tokens.map((token) => token.assetId))
  );

export const withdrawPayoutsFpTs: (
  client: FPTSRestAPI
) => (wallet: WalletAPI) => (payoutIds: PayoutId[]) => TE.TaskEither<Error | DecodingError, void> =
  (client) => (wallet) => (payoutIds) =>
    pipe(
      tryCatchDefault(() => getAddressesAndCollaterals(wallet)),
      TE.chain((addressesAndCollaterals) => client.withdrawals.post(payoutIds, addressesAndCollaterals)),
      TE.chainW((withdrawalTextEnvelope) =>
        pipe(
          tryCatchDefault(() => wallet.signTx(withdrawalTextEnvelope.tx.cborHex)),
          TE.chain((hexTransactionWitnessSet) =>
            client.withdrawals.withdrawal.put(withdrawalTextEnvelope.withdrawalId, hexTransactionWitnessSet)
          ),
          TE.map(() => withdrawalTextEnvelope.withdrawalId)
        )
      ),
      TE.chainFirstW((withdrawalId) =>
        tryCatchDefault(() => wallet.waitConfirmation(pipe(withdrawalId, withdrawalIdToTxId)))
      ),
      TE.map(constVoid)
    );
