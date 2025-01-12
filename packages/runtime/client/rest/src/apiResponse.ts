import { Either } from "fp-ts/lib/Either.js";
import { Errors } from "io-ts";

// Let's handle specific errors which we know about.
// Generic `Error` is not very informative even if wrapped in `TaskEither`..
export type NetworkError = {
  type: 'network';
  message: string;
};

export type HTTPError<EndpointError> = {
  type: 'http';
  status: number;
  message: string;
  body: EndpointError;
};

export type DecodingError = {
  type: 'decoding';
  errors: Errors;
};

export const mkDecodingError = (errors: Errors): DecodingError => ({ type: 'decoding', errors });

export type APIError<EndpointError> = NetworkError | HTTPError<EndpointError> | DecodingError;

export type APIResponse<EndpointError, Response> = Either<APIError<EndpointError>, Response>;

