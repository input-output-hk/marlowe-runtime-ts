import * as t from "io-ts/lib/index.js";
import { PathReporter } from "io-ts/lib/PathReporter.js";
import { pipe } from "fp-ts/lib/function.js";
import * as E from "fp-ts/lib/Either.js";
import * as G from "@marlowe.io/language-core-v1/guards";
import * as P from "@marlowe.io/language-core-v1/playground-v1";
import jsonBigInt from "json-bigint";
import { createJsonStream } from "./jsonStream.js";
import { Environment, MarloweState, Value } from "@marlowe.io/language-core-v1";
import {
  evalValue,
  evalObservation,
  computeTransaction,
  playTrace,
  emptyState,
} from "@marlowe.io/language-core-v1/semantics";
// // We need to patch the JSON.stringify in order for BigInt serialization to work.
const { stringify, parse } = jsonBigInt({
  useNativeBigInt: true,
  alwaysParseAsBig: true,
});

JSON.stringify = stringify;
JSON.parse = parse;

main();

function requestResponse(res: unknown) {
  console.log(JSON.stringify({ "request-response": res }));
}

function serializationRequest(json: unknown) {
  return { "serialization-success": json };
}

function rountripSerialization(typeId: string, json: unknown) {
  const guards = {
    "Core.Bound": G.Bound,
    "Core.Value": G.Value,
    "Core.Token": G.Token,
    "Core.Party": G.Party,
    "Core.Payee": G.Payee,
    "Core.ChoiceId": G.ChoiceId,
    "Core.Observation": G.Observation,
    "Core.Action": G.Action,
    "Core.Contract": G.Contract,
    "Core.Input": G.Input,
    "Core.Transaction": G.Transaction,
    "Core.Payment": G.Payment,
    "Core.State": G.MarloweState,
    "Core.TransactionWarning": G.TransactionWarning,
    "Core.IntervalError": G.IntervalError,
    "Core.TransactionError": G.TransactionError,
    "Core.TransactionOutput": G.TransactionOutput,
  } as Record<string, t.Mixed>;

  if (typeId in guards) {
    const guard = guards[typeId];
    const result = guard.decode(json);

    return pipe(
      result,
      E.match(
        (errors) => {
          const errMessage = PathReporter.report(result).join("\n");
          requestResponse({ "serialization-error": errMessage });
        },
        (obj) => requestResponse(serializationRequest(guard.encode(obj)))
      )
    );
  }
  return requestResponse({ "unknown-type": typeId });
}

function testEvalValue(env: Environment, state: MarloweState, value: Value) {
  requestResponse(evalValue(env, state, value));
}
function token(currency_symbol: string, token_name: string) {
  return { currency_symbol, token_name };
}
function generateRandomValue(typeId: string, seed: number) {
  const tokens = [token("", ""), token("abc", "abc"), token("def", "def"), token("abc", "def"), token("def", "abc")];
  const parties = [P.Address("abc"), P.Role("abc"), P.Address("def"), P.Role("def")];

  if (typeId == "Core.Token") {
    return requestResponse({ value: tokens[seed % tokens.length] });
  } else if (typeId == "Core.Party") {
    return requestResponse({ value: parties[seed % parties.length] });
  }
  return requestResponse({ "unknown-type": typeId });
}

const RoundtripSerializationRequest = t.type({
  request: t.literal("test-roundtrip-serialization"),
  typeId: t.string,
  json: t.unknown,
});

const GenerateRandomValueRequest = t.type({
  request: t.literal("generate-random-value"),
  typeId: t.string,
  seed: t.bigint,
});

const EvalValueRequest = t.type({
  request: t.literal("eval-value"),
  environment: G.Environment,
  value: G.Value,
  state: G.MarloweState,
});

const EvalObservationRequest = t.type({
  request: t.literal("eval-observation"),
  environment: G.Environment,
  observation: G.Observation,
  state: G.MarloweState,
});

const ComputeTransactionRequest = t.type({
  request: t.literal("compute-transaction"),
  transactionInput: G.Transaction,
  coreContract: G.Contract,
  state: G.MarloweState,
});

const PlayTraceRequest = t.type({
  request: t.literal("playtrace"),
  transactionInputs: t.array(G.Transaction),
  coreContract: G.Contract,
  initialTime: t.bigint,
});

function main() {
  createJsonStream({
    stream: process.stdin,
    sliceSize: 4096,
    beginSeparator: "```",
    endSeparator: "```",
    onJson: (req) => {
      if (RoundtripSerializationRequest.is(req)) {
        return rountripSerialization(req.typeId, req.json);
      }
      if (GenerateRandomValueRequest.is(req)) {
        return generateRandomValue(req.typeId, Number(req.seed));
      }
      if (EvalValueRequest.is(req)) {
        return testEvalValue(req.environment, req.state, req.value);
      }
      if (EvalObservationRequest.is(req)) {
        return requestResponse(evalObservation(req.environment, req.state, req.observation));
      }
      if (ComputeTransactionRequest.is(req)) {
        return requestResponse(computeTransaction(req.transactionInput, req.state, req.coreContract));
      }
      if (PlayTraceRequest.is(req)) {
        return requestResponse(playTrace(emptyState(req.initialTime), req.coreContract, req.transactionInputs));
      }
      return console.log("RequestNotImplemented");
    },
    onFinish: () => console.log("finished"),
  });
}
