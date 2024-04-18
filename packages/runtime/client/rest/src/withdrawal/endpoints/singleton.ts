/* eslint-disable sort-keys-fix/sort-keys-fix */
/* eslint-disable no-use-before-define */
import { AxiosInstance } from "axios";
import * as E from "fp-ts/lib/Either.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { pipe } from "fp-ts/lib/function.js";
import * as HTTP from "@marlowe.io/adapter/http";
import * as t from "io-ts/lib/index.js";

import { formatValidationErrors } from "jsonbigint-io-ts-reporters";

import { WithdrawalDetails } from "../details.js";
import { DecodingError } from "@marlowe.io/adapter/codec";
import {
  BlockHeader,
  HexTransactionWitnessSet,
  HexTransactionWitnessSetGuard,
  WithdrawalId,
  transactionWitnessSetTextEnvelope,
  unWithdrawalId,
} from "@marlowe.io/runtime-core";
import { TxStatus } from "../../contract/transaction/status.js";
import { PayoutHeader } from "../../payout/header.js";
import { assertGuardEqual, proxy } from "@marlowe.io/adapter/io-ts";

export type GET = (withdrawalId: WithdrawalId) => TE.TaskEither<Error | DecodingError, WithdrawalDetails>;

/**
 * Request options for the {@link index.RestClient#getWithdrawalById | Get withdrawal by ID } endpoint
 * @category Endpoint : Get withdrawal by ID
 */
export interface GetWithdrawalByIdRequest {
  withdrawalId: WithdrawalId;
}

export const GetWithdrawalByIdRequestGuard = assertGuardEqual(
  proxy<GetWithdrawalByIdRequest>(),
  t.type({ withdrawalId: WithdrawalId })
);

/**
 * Request options for the {@link index.RestClient#submitWithdrawal | Submit withdrawal } endpoint
 * @category Endpoint : Submit withdrawal
 */
export interface SubmitWithdrawalRequest {
  withdrawalId: WithdrawalId;
  hexTransactionWitnessSet: HexTransactionWitnessSet;
}

export const SubmitWithdrawalRequestGuard = assertGuardEqual(
  proxy<SubmitWithdrawalRequest>(),
  t.type({
    withdrawalId: WithdrawalId,
    hexTransactionWitnessSet: HexTransactionWitnessSetGuard,
  })
);

export type GetWithdrawalByIdResponse = {
  withdrawalId: WithdrawalId;
  status: TxStatus;
  block?: BlockHeader;
  payouts: PayoutHeader[];
};

/**
 * @see {@link https://docs.marlowe.iohk.io/api/get-withdrawal-by-id}
 */
export const getViaAxios: (axiosInstance: AxiosInstance) => GET = (axiosInstance) => (withdrawalId) =>
  pipe(
    HTTP.Get(axiosInstance)(endpointURI(withdrawalId), {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }),
    TE.chainW((data) => TE.fromEither(E.mapLeft(formatValidationErrors)(WithdrawalDetails.decode(data))))
  );

export type PUT = (
  withdrawalId: WithdrawalId,
  hexTransactionWitnessSet: HexTransactionWitnessSet
) => TE.TaskEither<Error, void>;

/**
 * @see {@link https://docs.marlowe.iohk.io/api/create-withdrawal}
 */
export const putViaAxios: (axiosInstance: AxiosInstance) => PUT =
  (axiosInstance) => (withdrawalId, hexTransactionWitnessSet) =>
    pipe(
      HTTP.Put(axiosInstance)(endpointURI(withdrawalId), transactionWitnessSetTextEnvelope(hexTransactionWitnessSet), {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      })
    );

const endpointURI = (withdrawalId: WithdrawalId): string =>
  `/withdrawals/${encodeURIComponent(unWithdrawalId(withdrawalId))}`;
