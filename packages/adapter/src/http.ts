import { AxiosInstance, AxiosResponse } from "axios";
import * as TE from "fp-ts/lib/TaskEither.js";
import { flow, identity } from "fp-ts/lib/function.js";
import { MarloweJSON } from "./codec.js";

const getOnlyData = TE.bimap(
  (e: unknown) => (e instanceof Error ? e : new Error(MarloweJSON.stringify(e))),
  // FIXME: This should be `unknown` rather than any, but it is causing multiple compile errors
  (v: AxiosResponse): any => v.data
);

const getWithDataAndHeaders = TE.bimap(
  (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
  // FIXME: This should be `unknown` rather than any, but it is causing multiple compile errors
  (v: AxiosResponse): any => [v.headers, v.data]
);

const getWithHeaders = TE.bimap(
  (e: unknown) => {
    console.log(JSON.stringify(e));
    return e instanceof Error ? e : new Error(String(e));
  },
  // FIXME: This should be `unknown` rather than any, but it is causing multiple compile errors
  (v: AxiosResponse): any => v.headers
);

export const Get = (request: AxiosInstance) => flow(TE.tryCatchK(request.get, identity), getOnlyData);

export const GetWithDataAndHeaders = (request: AxiosInstance) =>
  flow(TE.tryCatchK(request.get, identity), getWithDataAndHeaders);

export const GetWithHeaders = (request: AxiosInstance) => flow(TE.tryCatchK(request.get, identity), getWithHeaders);

export const Post = (request: AxiosInstance) => flow(TE.tryCatchK(request.post, identity), getOnlyData);

export const Put = (request: AxiosInstance) => flow(TE.tryCatchK(request.put, identity), getOnlyData);
