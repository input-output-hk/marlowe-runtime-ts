import { describe, expect, test } from "@jest/globals";
import {
  Accounts,
  Add,
  Close,
  Contract,
  Do,
  Environment,
  If,
  Notify,
  Party,
  Payee,
  Role,
  SetContingency,
  TimeInterval,
  Token,
  token,
  When,
  ada,
  emptyState,
} from "./marlowe";
import jsonBigInt from "json-bigint";

// We need to patch the JSON.stringify in order for BigInt serialization to work.
const { stringify, parse } = jsonBigInt({
  useNativeBigInt: true,
});

JSON.stringify = stringify;
JSON.parse = parse;

function asJson(obj: unknown) {
  return JSON.parse(JSON.stringify(obj));
}

function asJsonWithContinuations(c: Contract) {
  return JSON.parse(
    JSON.stringify({ contract: c, continuations: [...c.continuations] })
  );
}

describe("Marlowe ts", () => {
  describe("Party", () => {
    test("parse Address", () => {
      expect(Party.parse({ address: "x" })).toHaveProperty("address", "x");
    });
    test("parse Role", () => {
      expect(Party.parse({ role_token: "x" })).toHaveProperty("roleName", "x");
    });
    test("fail parse", () => {
      expect(() => Party.parse({ unk: "x" })).toThrow();
    });
  });
  describe("Token", () => {
    test("parse Token", () => {
      const tok = Token.parse({ currency_symbol: "x", token_name: "y" });

      expect(tok.currencySymbol).toBe("x");
      expect(tok.tokenName).toBe("y");
    });
    test("fail parse", () => {
      expect(() => Token.parse({ currency_symbol: "x" })).toThrow();
    });
  });
  describe("Value", () => {
    const defaultEnv = new Environment(
      new TimeInterval(new Date(0), new Date(5))
    );
    const defaultState = emptyState(new Date(0));
    test("eval Add(1,2) = 3", () => {
      expect(Add(1, 2).eval(defaultEnv, defaultState)).toBe(3n);
    });

    test("eval Add(1,2).neg() = -3", () => {
      expect(Add(1, 2).neg().eval(defaultEnv, defaultState)).toBe(-3n);
    });
  });
  describe("Payee", () => {
    test("Parse Payee", () => {
      const payeeObj = { account: { address: "x" } };
      const parsed = Payee.parse(payeeObj) as any;
      expect(parsed).toHaveProperty("account");
      expect(parsed.account).toHaveProperty("address", "x");
    });
  });
  describe("Contingency", () => {
    const partyA = Role("partyA");
    test("default contingency", () => {
      expect(When([]).toJSON().timeout).toBe(0);
    });
    test("When with after", () => {
      const json = asJson(When([]).after(new Date(10), Close));
      expect(json.timeout).toBe(10);
    });
    test("Set default contingency", () => {
      // const json = asJson(SetContingency(new Date(11), Close)(When([])));
      const json = asJson(SetContingency(When([])).after(new Date(11), Close));
      expect(json.timeout).toBe(11);
    });
    test("Set default contingency with after override", () => {
      const json = asJson(
        // SetContingency(new Date(11), Close)(When([]).after(new Date(10), Close))
        SetContingency(When([]).after(new Date(10), Close)).after(
          new Date(11),
          Close
        )
      );
      expect(json.timeout).toBe(10);
    });
    test("Set default contingency in nested when", () => {
      const json = asJson(
        // SetContingency(new Date(11), Close)(When([Notify(true).then(When([]))]))
        SetContingency(When([Notify(true).then(When([]))])).after(
          new Date(11),
          Close
        )
      );
      expect(json.timeout).toBe(11);
      expect(json.when[0].then.timeout).toBe(11);
    });
    test("Set default contingency in nested when with first override", () => {
      const json = asJson(
        SetContingency(
          When([Notify(true).then(When([]))]).after(new Date(12), Close)
        ).after(new Date(11), Close)
      );
      expect(json.timeout).toBe(12);
      expect(json.when[0].then.timeout).toBe(11);
    });
    test("Set default contingency in nested when with second override", () => {
      const json = asJson(
        SetContingency(
          When([Notify(true).then(When([]).after(new Date(12), Close))])
        ).after(new Date(11), Close)
      );
      expect(json.timeout).toBe(11);
      expect(json.when[0].then.timeout).toBe(12);
    });
    test("Set default contingency in nested when with both override", () => {
      const json = asJson(
        SetContingency(
          When([Notify(true).then(When([]).after(new Date(12), Close))]).after(
            new Date(13),
            Close
          )
        ).after(new Date(11), Close)
      );
      expect(json.timeout).toBe(13);
      expect(json.when[0].then.timeout).toBe(12);
    });
    test("Set nested default contingency", () => {
      const json = asJson(
        SetContingency(
          When([
            Notify(true).then(
              SetContingency(When([])).after(new Date(12), Close)
            ),
          ])
        ).after(new Date(11), Close)
      );
      expect(json.timeout).toBe(11);
      expect(json.when[0].then.timeout).toBe(12);
    });
    test("Set default contingency on Pay", () => {
      const json = asJson(
        SetContingency(partyA.payOut(2, ada).to(partyA).then(When([]))).after(
          new Date(11),
          Close
        )
      );
      expect(json.then.timeout).toBe(11);
    });
    test("Set default contingency on If then", () => {
      const json = asJson(
        SetContingency(If(true).then(When([])).else(Close)).after(
          new Date(11),
          Close
        )
      );
      expect(json.then.timeout).toBe(11);
    });
    test("Set default contingency on If else", () => {
      const json = asJson(
        SetContingency(If(true).then(Close).else(When([]))).after(
          new Date(11),
          Close
        )
      );
      expect(json.else.timeout).toBe(11);
    });

    test("Set default contingency on merkleized contract", () => {
      const json = asJsonWithContinuations(
        SetContingency(When([Notify(true).then(() => When([]))])).after(
          new Date(11),
          Close
        )
      );
      expect(json.continuations[0][1].timeout).toBe(11);
    });
    test("Set default contingency on merkleized contract that starts with Pay", () => {
      const json = asJsonWithContinuations(
        SetContingency(
          Do(
            partyA.payOut(2, ada).to(partyA),
            When([Notify(true).then(() => When([]))])
          )
        ).after(new Date(11), Close)
      );
      expect(json.continuations[0][1].timeout).toBe(11);
    });

    test("Unset default contingency on default timeout", () => {
      const json = asJson(
        SetContingency(When([Notify(true).then(Close)])).after(
          new Date(11),
          When([Notify(true).then(Close)])
        )
      );
      expect(json.timeout).toBe(11);
      expect(json.timeout_continuation.timeout).toBe(0);
    });
    // TODO: default Contingency on timeout (with and without after)
    test("Set default contingency on timeout", () => {
      const json = asJson(
        SetContingency(
          When([Notify(true).then(Close)]).after(
            new Date(12),
            When([Notify(true).then(Close)])
          )
        ).after(new Date(11), Close)
      );
      expect(json.timeout).toBe(12);
      expect(json.timeout_continuation.timeout).toBe(11);
    });
  });
  describe("Accounts", () => {
    const partyA = Role("roleA");
    test("Available money of empty accounts", () => {
      const accs = new Accounts();
      expect(accs.availableMoney(partyA, ada)).toBe(0n);
    });
    test("Available money of initialized accounts", () => {
      const accs = new Accounts([[partyA, ada, 3n]]);
      expect(accs.availableMoney(partyA, ada)).toBe(3n);
    });
    test("Available money of equivalent accounts", () => {
      const accs = new Accounts([[partyA, ada, 3n]]);
      expect(accs.availableMoney(partyA, token("", ""))).toBe(3n);
    });
    test("Available money of repeated accounts", () => {
      const accs = new Accounts([
        [partyA, ada, 3n],
        [partyA, ada, 5n],
      ]);
      expect(accs.availableMoney(partyA, token("", ""))).toBe(5n);
    });
    test("Available money of negative accounts", () => {
      const accs = new Accounts([[partyA, ada, -3n]]);
      expect(accs.availableMoney(partyA, ada)).toBe(0n);
    });
    test("Set does not mutate", () => {
      const accs = new Accounts([[partyA, ada, 3n]]);
      const accs2 = accs.set(partyA, ada, 5n);
      expect(accs.availableMoney(partyA, ada)).toBe(3n);
      expect(accs2.availableMoney(partyA, ada)).toBe(5n);
    });
  });
});
