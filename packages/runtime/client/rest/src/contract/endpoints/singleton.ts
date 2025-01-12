import * as E from "fp-ts/lib/Either.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { pipe } from "fp-ts/lib/function.js";
import * as t from "io-ts/lib/index.js";

import { AxiosInstance, isAxiosError } from "axios";

import { formatValidationErrors } from "jsonbigint-io-ts-reporters";

import * as HTTP from "@marlowe.io/adapter/http";

import {
  ContractIdGuard,
  HexTransactionWitnessSet,
  TextEnvelope,
  TextEnvelopeGuard,
  transactionWitnessSetTextEnvelope,
} from "@marlowe.io/runtime-core";

import { type ContractDetails, ContractDetailsGuard } from "../details.js";
import { ContractId } from "@marlowe.io/runtime-core";
import { unsafeEither, unsafeTaskEither } from "@marlowe.io/adapter/fp-ts";
import { assertGuardEqual, proxy } from "@marlowe.io/adapter/io-ts";
import { left, match, right } from "fp-ts/lib/Either.js";
import { APIError, APIResponse, HTTPError, NetworkError } from "../../apiResponse.js";
import { Validation } from "io-ts/lib/index.js";
import { Errors } from "io-ts/lib/index.js";

// export type GET = (contractId: ContractId) => TE.TaskEither<Error | DecodingError, ContractDetails>;

type GETPayload = t.TypeOf<typeof GETPayload>;
const GETPayload = t.type({
  links: t.type({}),
  resource: ContractDetailsGuard,
});

/**
 * Request options for the {@link index.RestClient#getContractById | Get contracts by ID } endpoint
 */
export type GetContractByIdRequest = t.TypeOf<typeof GetContractByIdRequest>;
export const GetContractByIdRequest = t.type({
  contractId: ContractIdGuard,
});

export type GetContractByIdResponse = APIResponse<string, ContractDetails>;

/**
 * @see {@link https://docs.marlowe.iohk.io/api/get-contract-by-id}
 */
export const getContractById = async (
  axiosInstance: AxiosInstance,
  contractId: ContractId
): Promise<GetContractByIdResponse> => {
  return axiosInstance.get(contractEndpoint(contractId), {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  }).then((response) => {
    const validation = GETPayload.decode(response.data);
    return match<Errors, { links: {}, resource: ContractDetails }, GetContractByIdResponse>(
      (errors: Errors) => left({
        type: 'decoding',
        errors
      }),
      (payload) => right(payload.resource)
    )(validation);
  }).catch((error) => {
    if(isAxiosError(error)) {
      if(error.response) {
        return left({
          type: 'http',
          status: error.response.status,
          message: error.message,
          body: error.response.data,
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

export type PUT = (
  contractId: ContractId,
  hexTransactionWitnessSet: HexTransactionWitnessSet
) => TE.TaskEither<Error, void>;

/**
 * Request options for the {@link index.RestClient#submitContract | Submit contract } endpoint
 * @category Endpoint : Submit contract
 */
export interface SubmitContractRequest {
  contractId: ContractId;
  txEnvelope: TextEnvelope;
}

export const SubmitContractRequestGuard = assertGuardEqual(
  proxy<SubmitContractRequest>(),
  t.type({
    contractId: ContractIdGuard,
    txEnvelope: TextEnvelopeGuard,
  })
);

export type InvalidTextEnvelope = {
  payload: string;
  envelope: TextEnvelope;
};

export type SubmitContractResponse = APIResponse<InvalidTextEnvelope|string, null>

export const submitContract = (axiosInstance: AxiosInstance) => (contractId: ContractId, envelope: TextEnvelope): Promise<SubmitContractResponse> =>
  axiosInstance
    .put(contractEndpoint(contractId), envelope, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })
    .then((_) => {
      return right(null);
    }).catch((error) => {
      if(isAxiosError(error)) {
        if(error.response) {
          const body = (() => {
            if(error.response.status === 400)
              return {
                payload: error.response.data,
                envelope: envelope
              }
            return error.response.data;
          })();
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

/**
 * @deprecated
 * @see {@link https://docs.marlowe.iohk.io/api/create-contracts-by-id}
 */
export const putViaAxios: (axiosInstance: AxiosInstance) => PUT =
  (axiosInstance) => (contractId, hexTransactionWitnessSet) =>
    pipe(
      HTTP.Put(axiosInstance)(
        contractEndpoint(contractId),
        transactionWitnessSetTextEnvelope(hexTransactionWitnessSet),
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      )
    );

const contractEndpoint = (contractId: ContractId): string => `/contracts/${encodeURIComponent(contractId)}`;
