import { AxiosInstance } from "axios";
import * as E from "fp-ts/lib/Either.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import * as G from "@marlowe.io/language-core-v1/guards";
import { pipe } from "fp-ts/lib/function.js";
import * as HTTP from "@marlowe.io/adapter/http";
import { formatValidationErrors } from "jsonbigint-io-ts-reporters";
import { ContractId, ContractIdGuard } from "@marlowe.io/runtime-core";
import { Environment, Party } from "@marlowe.io/language-core-v1";
import { Next } from "@marlowe.io/language-core-v1/next";
import { stringify } from "qs";
import { DecodingError } from "@marlowe.io/adapter/codec";
import { posixTimeToIso8601 } from "@marlowe.io/adapter/time";
import { assertGuardEqual, proxy } from "@marlowe.io/adapter/io-ts";
import * as t from "io-ts/lib/index.js";

export type GET = (
  contractId: ContractId
) => (environment: Environment) => (parties: Party[]) => TE.TaskEither<Error | DecodingError, Next>;

export const getViaAxios: (axiosInstance: AxiosInstance) => GET =
  (axiosInstance) => (contractId) => (environment) => (parties) =>
    pipe(
      HTTP.Get(axiosInstance)(
        contractNextEndpoint(contractId) +
          `?validityStart=${posixTimeToIso8601(environment.timeInterval.from)}&validityEnd=${posixTimeToIso8601(
            environment.timeInterval.to
          )}&` +
          stringify({ party: parties }, { indices: false }),
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      ),
      TE.chainW((data) => TE.fromEither(E.mapLeft(formatValidationErrors)(Next.decode(data))))
    );

const contractNextEndpoint = (contractId: ContractId): string => `/contracts/${encodeURIComponent(contractId)}/next`;

export interface GetNextStepsForContractRequest {
  contractId: ContractId;
  validityStart: bigint;
  validityEnd: bigint;
  parties?: Party[];
}

export const GetNextStepsForContractRequestGuard = assertGuardEqual(
  proxy<GetNextStepsForContractRequest>(),
  t.intersection([
    t.type({
      contractId: ContractIdGuard,
      validityStart: t.bigint,
      validityEnd: t.bigint,
    }),
    t.partial({
      parties: t.array(G.Party),
    }),
  ])
);

export type GetNextStepsForContractResponse = Next;

const GetNextStepsForContractResponseGuard = Next;

export const getNextStepsForContract =
  (axiosInstance: AxiosInstance) =>
  async ({
    contractId,
    validityStart,
    validityEnd,
    parties,
  }: GetNextStepsForContractRequest): Promise<GetNextStepsForContractResponse> => {
    const response = await axiosInstance.get(
      `/contracts/${encodeURIComponent(contractId)}/next?${stringify({
        validityStart: posixTimeToIso8601(validityStart),
        validityEnd: posixTimeToIso8601(validityEnd),
        party: parties,
      })}`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    return pipe(
      GetNextStepsForContractResponseGuard.decode(response.data),
      E.match(
        (e) => {
          throw formatValidationErrors(e);
        },
        (e) => e
      )
    );
  };
