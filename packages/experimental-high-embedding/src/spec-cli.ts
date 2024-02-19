import { Readable } from "node:stream";
import {
  Action,
  Address,
  Bound,
  ChoiceId,
  Contract,
  Observation,
  Party,
  Payee,
  Role,
  Token,
  Value,
  token,
} from "./index.js";
import * as t from "io-ts/lib/index.js";
import jsonBigInt from "json-bigint";

// We need to patch the JSON.stringify in order for BigInt serialization to work.
const { stringify, parse } = jsonBigInt({
  useNativeBigInt: true,
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
  const parsers = {
    "Core.Bound": Bound.parse,
    "Core.Value": Value.parse,
    "Core.Token": Token.parse,
    "Core.Party": Party.parse,
    "Core.Payee": Payee.parse,
    "Core.ChoiceId": ChoiceId.parse,
    "Core.Observation": Observation.parse,
    "Core.Action": Action.parse,
    "Core.Contract": Contract.parse,
  } as any;
  if (typeId in parsers) {
    const parser = parsers[typeId];
    try {
      return requestResponse(serializationRequest(parser(json)));
    } catch (err) {
      const errMessage =
        typeof err === "object" && typeof (err as any).toString === "function"
          ? (err as any).toString()
          : "Unknown problem";
      return requestResponse({ "serialization-error": errMessage });
    }
  }
  return requestResponse({ "unknown-type": typeId });
}
function generateRandomValue(typeId: string, seed: number) {
  const tokens = [
    token("", ""),
    token("abc", "abc"),
    token("def", "def"),
    token("abc", "def"),
    token("def", "abc"),
  ];
  const parties = [Address("abc"), Role("abc"), Address("def"), Role("def")];

  if (typeId == "Core.Token") {
    return requestResponse({ value: tokens[seed % tokens.length] });
  } else if (typeId == "Core.Party") {
    return requestResponse({ value: parties[seed % parties.length] });
  }
  return requestResponse({ "unknown-type": typeId });
}

const TestRoundtripSerializationMsg = t.type({
  request: t.literal("test-roundtrip-serialization"),
  typeId: t.string,
  json: t.unknown,
});

const GenerateRandomValueMsg = t.type({
  request: t.literal("generate-random-value"),
  typeId: t.string,
  seed: t.number,
});

function main() {
  createJsonStream({
    stream: process.stdin,
    sliceSize: 4096,
    beginSeparator: "```",
    endSeparator: "```",
    onJson: (obj) => {
      if (TestRoundtripSerializationMsg.is(obj)) {
        return rountripSerialization(obj.typeId, obj.json);
      }
      if (GenerateRandomValueMsg.is(obj)) {
        return generateRandomValue(obj.typeId, obj.seed);
      }
      return console.log("RequestNotImplemented");
    },
    onFinish: () => console.log("finished"),
  });
}

type JSONStreamOpts = {
  stream: Readable;
  sliceSize: number;
  beginSeparator: string;
  endSeparator: string;
  onJson: (obj: unknown) => void;
  onFinish: () => void;
};
// This Function starts reading a stream, discarding characters until
// it reaches the begin separator, then it reads until it reaches the
// end separator. If the inner string can be parsed as Json, it fires
// an onJson event.
function createJsonStream({
  stream,
  sliceSize,
  beginSeparator,
  endSeparator,
  onJson,
  onFinish,
}: JSONStreamOpts) {
  stream.setEncoding("utf8");
  let jsonBuffer = Buffer.alloc(sliceSize);
  let jsonIndex = 0;
  let inJson = false;

  function resizeBuffer(minSize: number) {
    jsonBuffer = Buffer.concat([
      jsonBuffer,
      Buffer.alloc(Math.max(minSize, sliceSize)),
    ]);
  }

  stream.on("close", () => onFinish());
  stream.on("data", (chunk) => {
    let i = 0;
    const chunkString = chunk.toString();
    while (i < chunk.length) {
      // If we are not in Json mode then we discard characters until we see the beginSeparator
      if (!inJson) {
        if (
          i + beginSeparator.length > chunk.length ||
          chunkString.substring(i, i + beginSeparator.length) != beginSeparator
        ) {
          i++;
        } else {
          inJson = true;
          i += beginSeparator.length;
          continue;
        }
      }

      // If we are in Json mode, we need to see if we are ending the sequence
      // or if we are accumulating chars into the jsonBuffer (with possible resize)
      if (inJson) {
        if (
          i + endSeparator.length <= chunk.length &&
          chunkString.substring(i, i + endSeparator.length) == endSeparator
        ) {
          // If we are here, we are ending the sequence
          const jsonString = jsonBuffer.toString().substring(0, jsonIndex);

          let json;
          try {
            json = JSON.parse(jsonString);
          } catch (err) {}
          if (typeof json === "undefined") {
            throw new Error("invalid json");
          } else {
            onJson(json);
          }
          i += endSeparator.length;
          inJson = false;
          jsonIndex = 0;
        } else {
          // If we are here, we are in json mode and we need to accumulate
          // the current char.

          // First we need to see if we need to resize the buffer at least
          // the rest of the chunk size.
          if (jsonIndex >= jsonBuffer.length) {
            resizeBuffer(chunk.length - i);
          }
          jsonBuffer.write(chunk[i], jsonIndex, 1, "utf8");
          jsonIndex++;
          i++;
        }
      }
    }
  });
}
