import { AxiosInstance } from "axios";

import * as TE from "fp-ts/lib/TaskEither.js";
import { pipe } from "fp-ts/lib/function.js";
import * as t from "io-ts/lib/index.js";
import * as E from "fp-ts/lib/Either.js";
import * as A from "fp-ts/lib/Array.js";

import { formatValidationErrors } from "jsonbigint-io-ts-reporters";

import * as HTTP from "@marlowe.io/adapter/http";
import { DecodingError } from "@marlowe.io/adapter/codec";

import {
  AddressBech32,
  AddressBech32Guard,
  AddressesAndCollaterals,
  AssetId,
  PayoutId,
  TextEnvelopeGuard,
  TxOutRef,
  WithdrawalId,
  unTxOutRef,
} from "@marlowe.io/runtime-core";

import { WithdrawalHeader } from "../header.js";
import { stringify } from "qs";
import { ItemRange, ItemRangeGuard, PageGuard } from "../../pagination.js";
import { assertGuardEqual, proxy } from "@marlowe.io/adapter/io-ts";

export type GetWithdrawalsRequest = {
  range?: ItemRange;
  partyRoles?: AssetId[];
};

export const GetWithdrawalsRequestGuard = assertGuardEqual(
  proxy<GetWithdrawalsRequest>(),
  t.partial({
    range: ItemRangeGuard,
    partyRoles: t.array(AssetId),
  })
);

export type GETHeadersByRange = (
  request?: GetWithdrawalsRequest
) => TE.TaskEither<Error | DecodingError, GetWithdrawalsResponse>;

const roleToParameter = (roleToken: AssetId) => `${roleToken.policyId}.${roleToken.assetName}`;

/**
 * @see {@link https://docs.marlowe.iohk.io/api/get-withdrawals}
 */
export const getHeadersByRangeViaAxios: (axiosInstance: AxiosInstance) => GETHeadersByRange =
  (axiosInstance) => (request) =>
    pipe(
      HTTP.GetWithDataAndHeaders(axiosInstance)(
        `/withdrawals${
          request && request.partyRoles
            ? stringify({ partyRole: request.partyRoles.map(roleToParameter) }, { indices: false })
            : ""
        }`,
        request && request.range ? { headers: { Range: request.range } } : {}
      ),
      TE.map(([headers, data]) => ({
        data: data,
        page: {
          current: headers["content-range"],
          next: headers["next-range"],
          total: Number(headers["total-count"]).valueOf(),
        },
      })),
      TE.chainW((data) => TE.fromEither(E.mapLeft(formatValidationErrors)(GETByRangeRawResponse.decode(data)))),
      TE.map((rawResponse) => ({
        withdrawals: pipe(
          rawResponse.data.results,
          A.map((result) => result.resource)
        ),
        page: rawResponse.page,
      }))
    );

type GETByRangeRawResponse = t.TypeOf<typeof GETByRangeRawResponse>;
const GETByRangeRawResponse = t.type({
  data: t.type({
    results: t.array(
      t.type({
        links: t.type({ contract: t.string, transactions: t.string }),
        resource: WithdrawalHeader,
      })
    ),
  }),
  page: PageGuard,
});

export type GetWithdrawalsResponse = t.TypeOf<typeof GetWithdrawalsResponse>;
export const GetWithdrawalsResponse = t.type({
  withdrawals: t.array(WithdrawalHeader),
  page: PageGuard,
});

export type WithdrawPayoutsRequest = {
  payoutIds: PayoutId[];
  changeAddress: AddressBech32;
  usedAddresses?: AddressBech32[];
  collateralUTxOs?: TxOutRef[];
};

export const WithdrawPayoutsRequestGuard = assertGuardEqual(
  proxy<WithdrawPayoutsRequest>(),
  t.intersection([
    t.type({
      payoutIds: t.array(PayoutId),
      changeAddress: AddressBech32Guard,
    }),
    t.partial({
      usedAddresses: t.array(AddressBech32Guard),
      collateralUTxOs: t.array(TxOutRef),
    }),
  ])
);

export type POST = (
  payoutIds: PayoutId[],
  addressesAndCollaterals: AddressesAndCollaterals
) => TE.TaskEither<Error | DecodingError, WithdrawPayoutsResponse>;

export type WithdrawPayoutsResponse = t.TypeOf<typeof WithdrawPayoutsResponse>;
export const WithdrawPayoutsResponse = t.type({
  withdrawalId: WithdrawalId,
  tx: TextEnvelopeGuard,
});

export type PostResponse = t.TypeOf<typeof PostResponse>;
export const PostResponse = t.type({
  links: t.type({}),
  resource: WithdrawPayoutsResponse,
});

/**
 * @see {@link https://docs.marlowe.iohk.io/api/create-withdrawals}
 */
export const postViaAxios: (axiosInstance: AxiosInstance) => POST =
  (axiosInstance) => (payoutIds, addressesAndCollaterals) =>
    pipe(
      HTTP.Post(axiosInstance)(
        "/withdrawals",
        { payouts: payoutIds },
        {
          headers: {
            Accept: "application/vendor.iog.marlowe-runtime.withdraw-tx-json",
            "Content-Type": "application/json",
            "X-Change-Address": addressesAndCollaterals.changeAddress,
            "X-Address": pipe(addressesAndCollaterals.usedAddresses, (a) => a.join(",")),
            "X-Collateral-UTxO": pipe(addressesAndCollaterals.collateralUTxOs, A.map(unTxOutRef), (a) => a.join(",")),
          },
        }
      ),
      TE.chainW((data) => TE.fromEither(E.mapLeft(formatValidationErrors)(PostResponse.decode(data)))),
      TE.map((payload) => payload.resource)
    );
