import * as t from "io-ts/lib/index.js";
import * as E from "fp-ts/lib/Either.js";
import * as A from "fp-ts/lib/Array.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { pipe } from "fp-ts/lib/function.js";
import { formatValidationErrors } from "jsonbigint-io-ts-reporters";
import { AxiosInstance } from "axios";

import * as G from "@marlowe.io/language-core-v1/guards";
import { MarloweVersion } from "@marlowe.io/language-core-v1/version";

import * as HTTP from "@marlowe.io/adapter/http";
import { DecodingError } from "@marlowe.io/adapter/codec";
import { ISO8601 } from "@marlowe.io/adapter/time";

import {
  AddressBech32,
  AddressBech32Guard,
  AddressesAndCollaterals,
  MetadataGuard,
  Metadata,
  Tags,
  TagsGuard,
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

export type GETHeadersByRange = (
  contractId: ContractId,
  range?: ItemRange
) => TE.TaskEither<Error | DecodingError, GetTransactionsForContractResponse>;

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

// TODO: Rename to ApplyInputsToContractResponse to match with buildCreateContractTx stye.
export interface TransactionTextEnvelope {
  contractId: ContractId;
  transactionId: TxId;
  tx: TextEnvelope;
}

export const TransactionTextEnvelope = assertGuardEqual(
  proxy<TransactionTextEnvelope>(),
  t.type({
    contractId: ContractIdGuard,
    transactionId: TxIdGuard,
    tx: TextEnvelopeGuard,
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

export const ApplyInputsToContractRequestGuard = assertGuardEqual(
  proxy<ApplyInputsToContractRequest>(),
  t.intersection([
    t.type({
      contractId: ContractIdGuard,
      changeAddress: AddressBech32Guard,
      inputs: t.array(G.Input),
    }),
    t.partial({
      usedAddresses: t.array(AddressBech32Guard),
      collateralUTxOs: t.array(TxOutRef),
      invalidBefore: ISO8601,
      invalidHereafter: ISO8601,
      version: MarloweVersion,
      metadata: MetadataGuard,
      tags: TagsGuard,
    }),
  ])
);

export type POST = (
  contractId: ContractId,
  postTransactionsRequest: PostTransactionsRequest,
  addressesAndCollaterals: AddressesAndCollaterals
) => TE.TaskEither<Error | DecodingError, TransactionTextEnvelope>;

export const postViaAxios: (axiosInstance: AxiosInstance) => POST =
  (axiosInstance) => (contractId, postTransactionsRequest, addressesAndCollaterals) =>
    pipe(
      HTTP.Post(axiosInstance)(transactionsEndpoint(contractId), postTransactionsRequest, {
        headers: {
          Accept: "application/vendor.iog.marlowe-runtime.apply-inputs-tx-json",
          "Content-Type": "application/json",
          "X-Change-Address": addressesAndCollaterals.changeAddress,
          "X-Address": pipe(addressesAndCollaterals.usedAddresses, (a) => a.join(",")),
          "X-Collateral-UTxO": pipe(addressesAndCollaterals.collateralUTxOs, A.map(unTxOutRef), (a) => a.join(",")),
        },
      }),
      TE.chainW((data) => TE.fromEither(E.mapLeft(formatValidationErrors)(PostResponse.decode(data)))),
      TE.map((payload) => payload.resource)
    );

export type PostTransactionsRequest = t.TypeOf<typeof PostTransactionsRequest>;
export const PostTransactionsRequest = t.intersection([
  t.type({
    version: MarloweVersion,
    inputs: t.array(G.Input),
    metadata: MetadataGuard,
    tags: TagsGuard,
  }),
  t.partial({ invalidBefore: ISO8601 }),
  t.partial({ invalidHereafter: ISO8601 }),
]);

export type PostResponse = t.TypeOf<typeof PostResponse>;
export const PostResponse = t.type({
  links: t.type({ transaction: t.string }),
  resource: TransactionTextEnvelope,
});

const transactionsEndpoint = (contractId: ContractId): string =>
  `/contracts/${encodeURIComponent(contractId)}/transactions`;
