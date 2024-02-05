import { describe, expect, test } from "@jest/globals";
import { num, objOf, str } from "./typeguards";

describe("Type guards", () => {
  describe("String", () => {
    test("Valid string", () => {
      const valid = "yeap" as unknown;

      if (str(valid)) {
        expect(str(valid)).toBe(true);
      } else {
        expect(true).toBe(false);
      }
    });
  });
  describe("Object of", () => {
    test("Single val", () => {
      const obj = { a: 1 } as unknown;
      if (objOf({ a: num })(obj)) {
        expect(typeof obj.a).toBe("number");
      } else {
        throw new Error("Not an object");
      }
    });
    test("nested objOf", () => {
      const obj = { a: { b: 1 } } as unknown;
      if (objOf({ a: objOf({ b: num }) })(obj)) {
        expect(typeof obj.a.b).toBe("number");
      } else {
        throw new Error("Not an object");
      }
    });
  });
});
