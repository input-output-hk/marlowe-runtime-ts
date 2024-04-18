import * as E from "fp-ts/lib/Either.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { pipe } from "fp-ts/lib/function.js";
import * as t from "io-ts/lib/index.js";

import { AxiosInstance } from "axios";

import { formatValidationErrors } from "jsonbigint-io-ts-reporters";

import * as HTTP from "@marlowe.io/adapter/http";
import { DecodingError } from "@marlowe.io/adapter/codec";

import {
  AddressBech32,
  AssetId,
  AssetsMap,
  ContractId,
  PayoutId,
  WithdrawalId,
  unPayoutId,
} from "@marlowe.io/runtime-core";
import { PayoutStatus, PayoutDetails } from "../index.js";
import { assertGuardEqual, proxy } from "@marlowe.io/adapter/io-ts";

export type GetPayoutByIdRequest = {
  payoutId: PayoutId;
};

export const GetPayoutByIdRequestGuard = assertGuardEqual(
  proxy<GetPayoutByIdRequest>(),
  t.type({ payoutId: PayoutId })
);

export type GetPayoutByIdResponse = {
  payoutId: PayoutId;
  contractId: ContractId;
  withdrawalId?: WithdrawalId;
  role: AssetId;
  payoutValidatorAddress: AddressBech32;
  status: PayoutStatus;
  assets: AssetsMap;
};

export type GET = (payoutId: PayoutId) => TE.TaskEither<Error | DecodingError, PayoutDetails>;

type GETPayload = t.TypeOf<typeof GETPayload>;
const GETPayload = t.type({ links: t.type({}), resource: PayoutDetails });

export const getViaAxios: (axiosInstance: AxiosInstance) => GET = (axiosInstance) => (contractId) =>
  pipe(
    HTTP.Get(axiosInstance)(contractEndpoint(contractId), {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }),
    TE.chainW((data) => TE.fromEither(E.mapLeft(formatValidationErrors)(GETPayload.decode(data)))),
    TE.map((payload) => payload.resource)
  );

const contractEndpoint = (payoutId: PayoutId): string => `/payouts/${encodeURIComponent(unPayoutId(payoutId))}`;
