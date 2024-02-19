import { describe, expect, test } from "@jest/globals";
import {
  Add,
  Close,
  Contract,
  If,
  Notify,
  Party,
  Payee,
  Role,
  SetContingency,
  Token,
  token,
  When,
  lovelace,
} from "../dist/esm/index.js";

import {
  SubValue,
  ConstantValue,
  Accounts,
  Environment,
  TimeInterval,
  emptyState,
  AvailableMoneyValue,
  NegValue,
  AddValue,
} from "../dist/esm/hom.js";
import {
  ContractGuard,
  ValueGuard,
  parseParty,
  parsePayee,
  parseToken,
} from "../dist/esm/guards.js";

import jsonBigInt from "json-bigint";

// We need to patch the JSON.stringify in order for BigInt serialization to work.
const { stringify, parse } = jsonBigInt({
  useNativeBigInt: true,
});

JSON.stringify = stringify;
JSON.parse = parse;

function contractAsJson(obj: Contract) {
  return ContractGuard.encode(obj);
}

describe("Marlowe ts", () => {
  describe("Party", () => {
    test("parse Address", () => {
      expect(parseParty({ address: "x" })).toHaveProperty("address", "x");
    });
    test("parse Role", () => {
      expect(parseParty({ role_token: "x" })).toHaveProperty("roleName", "x");
    });
    test("fail parse", () => {
      expect(() => parseParty({ unk: "x" })).toThrow();
    });
  });
  describe("Token", () => {
    test("parse Token", () => {
      const tok = parseToken({ currency_symbol: "x", token_name: "y" });

      expect(tok.currencySymbol).toBe("x");
      expect(tok.tokenName).toBe("y");
    });
    test("fail parse", () => {
      expect(() => parseToken({ currency_symbol: "x" })).toThrow();
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
    test("Decode AvailableMoney", () => {
      const availableMoney = {
        amount_of_token: { currency_symbol: "", token_name: "" },
        in_account: { role_token: "some role" },
      };
      const decoded = ValueGuard.decode(availableMoney);
      expect(decoded._tag).toBe("Right");
      expect((decoded as any).right).toBeInstanceOf(AvailableMoneyValue);
    });
    test("Decode NegValue", () => {
      const availableMoney = {
        amount_of_token: { currency_symbol: "", token_name: "" },
        in_account: { role_token: "some role" },
      };
      const negAvailableMoney = {
        negate: availableMoney,
      };
      const decoded = ValueGuard.decode(negAvailableMoney);
      expect(decoded._tag).toBe("Right");
      expect((decoded as any).right).toBeInstanceOf(NegValue);
    });
    test("Decode AddValue", () => {
      const addValue = {
        add: 1n,
        and: { negate: 1n },
      };
      const decoded = ValueGuard.decode(addValue);
      expect(decoded._tag).toBe("Right");
      expect((decoded as any).right).toBeInstanceOf(AddValue);
      const addValueObj = (decoded as any).right as AddValue;
      expect(addValueObj.left).toBeInstanceOf(ConstantValue);
      expect(addValueObj.right).toBeInstanceOf(NegValue);
    });
    test("Decode SubValue", () => {
      const subValue = {
        value: 1n,
        minus: { negate: 2n },
      };
      const decoded = ValueGuard.decode(subValue);
      expect(decoded._tag).toBe("Right");
      expect((decoded as any).right).toBeInstanceOf(SubValue);
      const subValueObj = (decoded as any).right as SubValue;
      expect(subValueObj.left).toBeInstanceOf(ConstantValue);
      expect(subValueObj.right).toBeInstanceOf(NegValue);
    });
    test("eval Add(1,2).neg() = -3", () => {
      expect(Add(1, 2).neg().eval(defaultEnv, defaultState)).toBe(-3n);
    });
  });
  describe("Payee", () => {
    test("Parse Payee", () => {
      const payeeObj = { account: { address: "x" } };
      const parsed = parsePayee(payeeObj) as any;
      expect(parsed).toHaveProperty("account");
      expect(parsed.account).toHaveProperty("address", "x");
    });
  });
  describe("Contingency", () => {
    const partyA = Role("partyA");
    test("default contingency", () => {
      const json = contractAsJson(When([]));
      expect(json).toHaveProperty("timeout", 0n);
    });
    test("When with after", () => {
      const json = contractAsJson(When([]).after(new Date(10), Close));
      expect(json).toHaveProperty("timeout", 10n);
    });

    test("Set default contingency", () => {
      const json = contractAsJson(
        SetContingency(When([])).after(new Date(11), Close)
      );
      expect(json).toHaveProperty("timeout", 11n);
    });

    test("Set default contingency with after override", () => {
      const json = contractAsJson(
        // SetContingency(new Date(11), Close)(When([]).after(new Date(10), Close))
        SetContingency(When([]).after(new Date(10), Close)).after(
          new Date(11),
          Close
        )
      );
      expect(json).toHaveProperty("timeout", 10n);
    });

    test("Set default contingency in nested when", () => {
      const json = contractAsJson(
        SetContingency(When([Notify(true).then(When([]))])).after(
          new Date(11),
          Close
        )
      );
      expect(json).toHaveProperty("timeout", 11n);
      expect(json).toHaveProperty("when[0].then.timeout", 11n);
    });

    test("Set default contingency in nested when with first override", () => {
      const json = contractAsJson(
        SetContingency(
          When([Notify(true).then(When([]))]).after(new Date(12), Close)
        ).after(new Date(11), Close)
      );
      expect(json).toHaveProperty("timeout", 12n);
      expect(json).toHaveProperty("when[0].then.timeout", 11n);
    });

    test("Set default contingency in nested when with second override", () => {
      const json = contractAsJson(
        SetContingency(
          When([Notify(true).then(When([]).after(new Date(12), Close))])
        ).after(new Date(11), Close)
      );
      expect(json).toHaveProperty("timeout", 11n);
      expect(json).toHaveProperty("when[0].then.timeout", 12n);
    });

    test("Set default contingency in nested when with both override", () => {
      const json = contractAsJson(
        SetContingency(
          When([Notify(true).then(When([]).after(new Date(12), Close))]).after(
            new Date(13),
            Close
          )
        ).after(new Date(11), Close)
      );
      expect(json).toHaveProperty("timeout", 13n);
      expect(json).toHaveProperty("when[0].then.timeout", 12n);
    });

    test("Set nested default contingency", () => {
      const json = contractAsJson(
        SetContingency(
          When([
            Notify(true).then(
              SetContingency(When([])).after(new Date(12), Close)
            ),
          ])
        ).after(new Date(11), Close)
      );
      expect(json).toHaveProperty("timeout", 11n);
      expect(json).toHaveProperty("when[0].then.timeout", 12n);
    });

    test("Set default contingency on Pay", () => {
      const json = contractAsJson(
        SetContingency(
          partyA.payOut(2, lovelace).to(partyA).then(When([]))
        ).after(new Date(11), Close)
      );
      expect(json).toHaveProperty("then.timeout", 11n);
    });

    test("Set default contingency on If then", () => {
      const json = contractAsJson(
        SetContingency(If(true).then(When([])).else(Close)).after(
          new Date(11),
          Close
        )
      );
      expect(json).toHaveProperty("then.timeout", 11n);
    });

    test("Set default contingency on If else", () => {
      const json = contractAsJson(
        SetContingency(If(true).then(Close).else(When([]))).after(
          new Date(11),
          Close
        )
      );
      expect(json).toHaveProperty("else.timeout", 11n);
    });

    // FIXME: this is not working
    test.skip("Set default contingency on merkleized contract", () => {
      const contract = SetContingency(
        // Main contract
        When([
          Notify(true).then(
            // Sub contract
            () => When([])
          ),
        ])
      ).after(new Date(11), Close);
      const bundleMap = contract.getRuntimeObject();
      const mainContractJson = bundleMap.objects[bundleMap.main];
      expect(mainContractJson).toHaveProperty("timeout", 11n);

      // expect(json.continuations[0].timeout).toBe(11);
    });
    // FIXME: this is not working
    /*test.skip("Set default contingency on merkleized contract that starts with Pay", () => {
      const json = asJsonWithContinuations(
        SetContingency(
          Do(
            partyA.payOut(2, lovelace).to(partyA),
            When([Notify(true).then(() => When([]))])
          )
        ).after(new Date(11), Close)
      );
      expect(json.continuations[0].timeout).toBe(11);
    });*/

    test("Unset default contingency on default timeout", () => {
      const json = contractAsJson(
        SetContingency(When([Notify(true).then(Close)])).after(
          new Date(11),
          When([Notify(true).then(Close)])
        )
      );
      expect(json).toHaveProperty("timeout", 11n);
      expect(json).toHaveProperty("timeout_continuation.timeout", 0n);
    });

    // TODO: default Contingency on timeout (with and without after)
    test("Set default contingency on timeout", () => {
      const json = contractAsJson(
        SetContingency(
          When([Notify(true).then(Close)]).after(
            new Date(12),
            When([Notify(true).then(Close)])
          )
        ).after(new Date(11), Close)
      );
      expect(json).toHaveProperty("timeout", 12n);
      expect(json).toHaveProperty("timeout_continuation.timeout", 11n);
    });
  });
  describe("Accounts", () => {
    const partyA = Role("roleA");
    test("Available money of empty accounts", () => {
      const accs = new Accounts();
      expect(accs.availableMoney(partyA, lovelace)).toBe(0n);
    });
    test("Available money of initialized accounts", () => {
      const accs = new Accounts([[partyA, lovelace, 3n]]);
      expect(accs.availableMoney(partyA, lovelace)).toBe(3n);
    });
    test("Available money of equivalent accounts", () => {
      const accs = new Accounts([[partyA, lovelace, 3n]]);
      expect(accs.availableMoney(partyA, token("", ""))).toBe(3n);
    });
    test("Available money of repeated accounts", () => {
      const accs = new Accounts([
        [partyA, lovelace, 3n],
        [partyA, lovelace, 5n],
      ]);
      expect(accs.availableMoney(partyA, token("", ""))).toBe(5n);
    });
    test("Available money of negative accounts", () => {
      const accs = new Accounts([[partyA, lovelace, -3n]]);
      expect(accs.availableMoney(partyA, lovelace)).toBe(0n);
    });
    test("Set does not mutate", () => {
      const accs = new Accounts([[partyA, lovelace, 3n]]);
      const accs2 = accs.set(partyA, lovelace, 5n);
      expect(accs.availableMoney(partyA, lovelace)).toBe(3n);
      expect(accs2.availableMoney(partyA, lovelace)).toBe(5n);
    });
  });
});
