import { AxiosInstance } from "axios";

import * as t from "io-ts/lib/index.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { pipe } from "fp-ts/lib/function.js";
import * as E from "fp-ts/lib/Either.js";
import * as A from "fp-ts/lib/Array.js";
import * as O from "fp-ts/lib/Option.js";
import { formatValidationErrors } from "jsonbigint-io-ts-reporters";
import { stringify } from "qs";

import * as HTTP from "@marlowe.io/adapter/http";
import { DecodingError } from "@marlowe.io/adapter/codec";

import { AssetId, ContractIdGuard } from "@marlowe.io/runtime-core";

import { ContractId } from "@marlowe.io/runtime-core";
import { PayoutHeader } from "../header.js";
import { PayoutStatus } from "../status.js";
import { ItemRange, ItemRangeGuard, Page, PageGuard } from "../../pagination.js";
import { assertGuardEqual, proxy } from "@marlowe.io/adapter/io-ts";

export type GetPayoutsRequest = {
  contractIds: ContractId[];
  roleTokens: AssetId[];
  status?: PayoutStatus;
  range?: ItemRange;
};

export const GetPayoutsRequestGuard = assertGuardEqual(
  proxy<GetPayoutsRequest>(),
  t.intersection([
    t.partial({
      status: PayoutStatus,
      range: ItemRangeGuard,
    }),
    t.type({
      contractIds: t.array(ContractIdGuard),
      roleTokens: t.array(AssetId),
    }),
  ])
);

export type GetPayoutsResponse = {
  payouts: PayoutHeader[];
  page: Page;
};

export type GETHeadersByRange = (
  range?: ItemRange
) => (
  contractIds: ContractId[]
) => (
  roles: AssetId[]
) => (statusOption: O.Option<PayoutStatus>) => TE.TaskEither<Error | DecodingError, GETByRangeResponse>;

const roleToParameter = (roleToken: AssetId) => `${roleToken.policyId}.${roleToken.assetName}`;
const statusOptionToParameter = (statusOption: O.Option<PayoutStatus>) =>
  pipe(
    statusOption,
    O.match(
      () => "",
      (a) => `status=${a}&`
    )
  );

export const getHeadersByRangeViaAxios: (axiosInstance: AxiosInstance) => GETHeadersByRange =
  (axiosInstance) => (range) => (contractIds) => (roles) => (statusOption) =>
    pipe(
      {
        url:
          "/payouts?" +
          statusOptionToParameter(statusOption) +
          stringify(
            {
              contractId: contractIds,
              roleToken: roles.map(roleToParameter),
            },
            { indices: false }
          ),
        configs: range ? { headers: { Range: range } } : {},
      },
      ({ url, configs }) => HTTP.GetWithDataAndHeaders(axiosInstance)(url, configs),
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
        payouts: pipe(
          rawResponse.data.results,
          A.map((result) => result.resource)
        ),
        page: rawResponse.page,
      }))
    );

export type GETByRangeRawResponse = t.TypeOf<typeof GETByRangeRawResponse>;
export const GETByRangeRawResponse = t.type({
  data: t.type({
    results: t.array(t.type({ links: t.type({ payout: t.string }), resource: PayoutHeader })),
  }),
  page: PageGuard,
});

export type GETByRangeResponse = t.TypeOf<typeof GETByRangeResponse>;
export const GETByRangeResponse = t.type({
  payouts: t.array(PayoutHeader),
  page: PageGuard,
});
