import { DateFromEpochMS, StringSplitCodec, TokenCodec } from "../src/codecs.js";
import * as t from "io-ts/lib/index.js";
describe("DateFromEpochMS", () => {
  it("should decode a number as a Date", () => {
    const aDate = DateFromEpochMS.decode(1704067200000);
    expect(aDate).toEqual(t.success(new Date("2024-01-01T00:00:00.000Z")));
  });
  it("should fail to decode a string", () => {
    const aDate = DateFromEpochMS.decode("1704067200000");
    expect(aDate).toHaveProperty("_tag", "Left");
  });
  it("should encode a date as a number", () => {
    const aDate = DateFromEpochMS.encode(new Date("2024-01-01T00:00:00.000Z"));
    expect(aDate).toEqual(1704067200000n);
  });
});

describe("StringCodec", () => {
  it("should decode a small string", () => {
    const aString = StringSplitCodec.decode(["hello"]);
    expect(aString).toEqual(t.success("hello"));
  });
  it("it should merge two strings", () => {
    const aString = StringSplitCodec.decode(["hello", "world"]);
    expect(aString).toEqual(t.success("helloworld"));
  });
  it("should encode a small string as a single element array", () => {
    const aString = StringSplitCodec.encode("hello");
    expect(aString).toEqual(["hello"]);
  });
  it("should split a string longer that 64 characters", () => {
    const aString = StringSplitCodec.encode("a".repeat(65));
    expect(aString).toEqual(["a".repeat(64), "a"]);
  });
  it("should fail to decode a number", () => {
    const aString = StringSplitCodec.decode(42);
    expect(aString).toHaveProperty("_tag", "Left");
  });
});

describe("TokenCodec", () => {
  it("should decode a valid token", () => {
    const aToken = TokenCodec.decode([["a"], ["b"]]);
    expect(aToken).toEqual(t.success({ currency_symbol: "a", token_name: "b" }));
  });
  it("should encode a valid token", () => {
    const aToken = TokenCodec.encode({ currency_symbol: "a", token_name: "b" });
    expect(aToken).toEqual([["a"], ["b"]]);
  });
});
