import * as t from "io-ts/lib/index.js";
import * as E from "fp-ts/lib/Either.js";
import * as A from "fp-ts/lib/Array.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { pipe } from "fp-ts/lib/function.js";
import { formatValidationErrors } from "jsonbigint-io-ts-reporters";
import { AxiosInstance, isAxiosError } from "axios";

import { MarloweVersion } from "@marlowe.io/language-core-v1/version";

import * as HTTP from "@marlowe.io/adapter/http";
import * as codec from "@marlowe.io/adapter/codec";
import { ISO8601 } from "@marlowe.io/adapter/time";

import {
  AddressBech32,
  AddressesAndCollaterals,
  Metadata,
  Tags,
  TextEnvelopeGuard,
  TxId,
  TxOutRef,
  unTxOutRef,
  ContractId,
  ContractIdGuard,
  TxIdGuard,
  TextEnvelope,
} from "@marlowe.io/runtime-core";
import { TxHeader, TxHeaderGuard } from "../header.js";
import { assertGuardEqual, proxy } from "@marlowe.io/adapter/io-ts";
import { Input } from "@marlowe.io/language-core-v1";
import { ItemRange, ItemRangeGuard, Page, PageGuard } from "../../../pagination.js";
import { APIResponse, mkDecodingError } from "../../../apiResponse.js";
import { left, match, right } from "fp-ts/lib/Either.js";
import { Errors } from "io-ts/lib/index.js";

export type GETHeadersByRange = (
  contractId: ContractId,
  range?: ItemRange
) => TE.TaskEither<Error | codec.DecodingError, GetTransactionsForContractResponse>;

export const getHeadersByRangeViaAxios: (axiosInstance: AxiosInstance) => GETHeadersByRange =
  (axiosInstance) => (contractId, range) =>
    pipe(
      HTTP.GetWithDataAndHeaders(axiosInstance)(
        transactionsEndpoint(contractId),
        range ? { headers: { Range: range } } : {}
      ),
      TE.map(([headers, data]) => ({
        data: data,
        page: {
          current: headers["content-range"],
          next: headers["next-range"],
          total: Number(headers["total-count"]).valueOf(),
        },
      })),
      TE.chainW((data) => TE.fromEither(E.mapLeft(formatValidationErrors)(GetContractsRawResponse.decode(data)))),
      TE.map((rawResponse) => ({
        transactions: pipe(
          rawResponse.data.results,
          A.map((result) => result.resource)
        ),
        page: rawResponse.page,
      }))
    );

type GetContractsRawResponse = t.TypeOf<typeof GetContractsRawResponse>;
const GetContractsRawResponse = t.type({
  data: t.type({
    results: t.array(t.type({ links: t.type({}), resource: TxHeaderGuard })),
  }),
  page: PageGuard,
});

/**
 * Request options for the {@link index.RestClient#getTransactionsForContract | Get transactions for contract } endpoint
 * @category Endpoint : Get transactions for contract
 */
export interface GetTransactionsForContractRequest {
  contractId: ContractId;
  range?: ItemRange;
}

export const GetTransactionsForContractRequestGuard = assertGuardEqual(
  proxy<GetTransactionsForContractRequest>(),
  t.intersection([
    t.type({
      contractId: ContractIdGuard,
    }),
    t.partial({
      range: ItemRangeGuard,
    }),
  ])
);

/**
 * Represents the response of the {@link index.RestClient#getTransactionsForContract | Get transactions for contract } endpoint
 * @category GetTransactionsForContractResponse
 */
export interface GetTransactionsForContractResponse {
  transactions: TxHeader[];
  page: Page;
}

/**
 * @hidden
 */
export const GetTransactionsForContractResponseGuard = assertGuardEqual(
  proxy<GetTransactionsForContractResponse>(),
  t.type({
    transactions: t.array(TxHeaderGuard),
    page: PageGuard,
  })
);

export type ApplyInputsToContractRequest = {
  contractId: ContractId;
  changeAddress: AddressBech32;
  usedAddresses?: AddressBech32[];
  collateralUTxOs?: TxOutRef[];
  invalidBefore?: ISO8601;
  invalidHereafter?: ISO8601;
  version?: MarloweVersion;
  metadata?: Metadata;
  tags?: Tags;
  inputs: Input[];
};

export type ApplyInputsToContractRequestPayload = {
  invalidBefore?: ISO8601;
  invalidHereafter?: ISO8601;
  version?: MarloweVersion;
  metadata?: Metadata;
  tags?: Tags;
  inputs: Input[];
};

export interface TransactionTextEnvelope {
  contractId: ContractId;
  transactionId: TxId;
  tx: TextEnvelope;
  safetyErrrors: string[] | undefined;
}

export const TransactionTextEnvelope = assertGuardEqual(
  proxy<TransactionTextEnvelope>(),
  t.type({
    contractId: ContractIdGuard,
    transactionId: TxIdGuard,
    tx: TextEnvelopeGuard,
    safetyErrrors: t.union([t.array(t.string), t.undefined]),
  })
);

export type InvalidTextEnvelope = {
  payload: string;
  envelope: TextEnvelope;
};

/**
 * Represents the response body (200 response) of the {@link index.RestClient#applyInputsToContract | Apply inputs to contract } endpoint
 * @hidden
 */
export type ApplyInputsToContractResponsePayload = t.TypeOf<typeof ApplyInputsToContractResponsePayload>;
export const ApplyInputsToContractResponsePayload = t.type({
  links: t.type({ transaction: t.string }),
  resource: TransactionTextEnvelope,
});

/**
 * Represents the response the {@link index.RestClient#applyInputsToContract | Apply inputs to contract } endpoint. It can be either a success or a API error or network error. Other types of errors are not expected and rethrown.
 * @category ApplyInputsToContractResponse
 */
export type ApplyInputsToContractResponse = APIResponse<string, TransactionTextEnvelope>

export const applyInputsToContract = (axiosInstance: AxiosInstance) => async (contractId: ContractId, request: ApplyInputsToContractRequestPayload, addressesAndCollaterals: AddressesAndCollaterals): Promise<ApplyInputsToContractResponse> => {
  return axiosInstance.post(transactionsEndpoint(contractId), request, {
    headers: {
      Accept: "application/vendor.iog.marlowe-runtime.apply-inputs-tx-json",
      "Content-Type": "application/json",
      "X-Change-Address": addressesAndCollaterals.changeAddress,
      "X-Address": pipe(addressesAndCollaterals.usedAddresses, (a) => a.join(",")),
      "X-Collateral-UTxO": pipe(addressesAndCollaterals.collateralUTxOs, A.map(unTxOutRef), (a) => a.join(",")),
    }}).then((response) => {
      return match(
        (errors: Errors) => left(mkDecodingError(errors)),
        (payload: { links: {}, resource: TransactionTextEnvelope}) => right(payload.resource)
      )(ApplyInputsToContractResponsePayload.decode(response.data));
    }).catch((error) => {
      if(isAxiosError(error)) {
        if(error.response) {
          const body = error.response.data;
          return left({
            type: 'http',
            status: error.response.status,
            message: error.message,
            body,
          });
        }
        return left({
          type: 'network',
          message: error.message
        });
      }
      throw error;
  });
};

const transactionsEndpoint = (contractId: ContractId): string =>
  `/contracts/${encodeURIComponent(contractId)}/transactions`;
