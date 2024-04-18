import { TemplateParametersOf, mkMarloweTemplate } from "@marlowe.io/marlowe-template";
describe("Template basic types", () => {
  const basicTemplate = mkMarloweTemplate({
    name: "Basic types template",
    description: "A test template with basic types",
    params: [
      { name: "str", type: "string", description: "A string" },
      { name: "num", type: "value", description: "A number" },
      { name: "dte", type: "date", description: "A date" },
    ] as const,
  });

  /** The inferred type should be
    {
      str: string,
      num: BigIntOrNumber,
      dte: Date
    }
   */
  type BasicParams = TemplateParametersOf<typeof basicTemplate>;

  const aDate = new Date("2024-01-01T00:00:00.000Z");
  const aDateMS = BigInt(aDate.getTime());

  it("should guard for correct values", () => {
    const a: BasicParams = { str: "hello", num: 42n, dte: aDate };

    expect(basicTemplate.is(a)).toBe(true);
  });

  it("should guard for incorrect values", () => {
    const a: BasicParams = {
      /** @ts-expect-error */
      str: 42n,
      /** @ts-expect-error */
      num: "hello",
      dte: aDate,
    };
    expect(basicTemplate.is(a)).toBe(false);
  });

  it("should encode a valid value", () => {
    const a: BasicParams = { str: "hello", num: 42, dte: aDate };
    expect(basicTemplate.toMetadata(a)).toEqual({
      "9041": {
        v: 1n,
        params: [["hello"], 42n, aDateMS],
      },
    });
  });

  it("should decode a valid value", () => {
    const metadata = {
      "9041": {
        v: 1n,
        params: [["hello"], 42n, aDateMS],
      },
    };

    expect(basicTemplate.fromMetadata(metadata)).toEqual({
      str: "hello",
      num: 42n,
      dte: aDate,
    });
  });

  it("should split a long string when encoding", () => {
    const a: BasicParams = {
      str: "a".repeat(65),
      num: 42n,
      dte: aDate,
    };
    expect(basicTemplate.toMetadata(a)).toEqual({
      "9041": {
        v: 1n,
        params: [["a".repeat(64), "a"], 42n, aDateMS],
      },
    });
  });

  it("should merge a split string when decoding", () => {
    const metadata = {
      "9041": {
        v: 1n,
        params: [["a".repeat(64), "a"], 42n, aDateMS],
      },
    };
    expect(basicTemplate.fromMetadata(metadata)).toEqual({
      str: "a".repeat(65),
      num: 42n,
      dte: aDate,
    });
  });
});
