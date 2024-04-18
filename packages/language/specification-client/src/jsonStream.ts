import { Readable } from "node:stream";

export type JSONStreamOpts = {
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
export function createJsonStream({
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
    jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(Math.max(minSize, sliceSize))]);
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
