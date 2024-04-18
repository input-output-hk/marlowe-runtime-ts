import { ContractBundleList, bundleListToMap, lovelace, Party } from "@marlowe.io/marlowe-object";

describe("bundleListToMap", () => {
  const aParty: Party = { address: "test1234" };
  it("should work for trivial bundle", () => {
    const bundleList: ContractBundleList<undefined> = {
      main: "main",
      bundle: [{ type: "contract", value: "close", label: "main" }],
    };

    const bundleMap = bundleListToMap(bundleList);
    expect(bundleMap).toEqual({
      main: "main",
      objects: {
        main: { type: "contract", value: "close" },
      },
    });
  });
  it("should work for all types", () => {
    const bundleList: ContractBundleList<undefined> = {
      main: "main",
      bundle: [
        {
          label: "o1",
          type: "observation",
          value: true,
        },
        {
          label: "partyNotifies",
          type: "action",
          value: {
            notify_if: {
              ref: "o1",
            },
          },
        },
        {
          label: "v1",
          type: "value",
          value: 1n,
        },
        {
          label: "lovelace",
          type: "token",
          value: {
            currency_symbol: "",
            token_name: "",
          },
        },
        {
          label: "aParty",
          type: "party",
          value: {
            address: "test1234",
          },
        },
        {
          label: "payParty",
          type: "contract",
          value: {
            pay: {
              ref: "v1",
            },
            token: {
              ref: "lovelace",
            },
            from_account: {
              ref: "aParty",
            },
            to: {
              party: {
                address: "test1234",
              },
            },
            then: "close",
          },
        },
        {
          label: "main",
          type: "contract",
          value: {
            when: [
              {
                case: {
                  ref: "partyNotifies",
                },
                then: {
                  ref: "payParty",
                },
              },
            ],
            timeout: 0n,
            timeout_continuation: "close",
          },
        },
      ],
    };
    const bundleMap = bundleListToMap(bundleList);
    expect(bundleMap).toEqual({
      main: "main",
      objects: {
        main: {
          type: "contract",
          value: {
            when: [{ case: { ref: "partyNotifies" }, then: { ref: "payParty" } }],
            timeout: 0n,
            timeout_continuation: "close",
          },
        },
        partyNotifies: {
          type: "action",
          value: {
            notify_if: { ref: "o1" },
          },
        },
        payParty: {
          type: "contract",
          value: {
            pay: { ref: "v1" },
            token: { ref: "lovelace" },
            from_account: { ref: "aParty" },
            to: { party: aParty },
            then: "close",
          },
        },
        lovelace: {
          type: "token",
          value: { currency_symbol: "", token_name: "" },
        },
        v1: { type: "value", value: 1n },
        o1: { type: "observation", value: true },
        aParty: {
          type: "party",
          value: aParty,
        },
      },
    });
  });

  it("should fail when the main reference is missing", () => {
    const bundleList: ContractBundleList<undefined> = {
      main: "main",
      bundle: [{ type: "contract", value: "close", label: "other" }],
    };
    expect(() => bundleListToMap(bundleList)).toThrowError(/Missing label main/);
  });

  it("should fail when a transitive reference is missing", () => {
    const bundleList: ContractBundleList<undefined> = {
      main: "main",
      bundle: [
        {
          label: "main",
          type: "contract",
          value: {
            pay: 1n,
            token: lovelace,
            from_account: aParty,
            to: { party: aParty },
            then: { ref: "other" },
          },
        },
      ],
    };
    expect(() => bundleListToMap(bundleList)).toThrowError(/Missing label other/);
  });
  it("should fail if the order is wrong", () => {
    const bundleList: ContractBundleList<undefined> = {
      main: "main",
      bundle: [
        {
          label: "main",
          type: "contract",
          value: {
            pay: 1n,
            token: lovelace,
            from_account: aParty,
            to: { party: aParty },
            then: { ref: "other" },
          },
        },
        { label: "other", type: "contract", value: "close" },
      ],
    };
    expect(() => bundleListToMap(bundleList)).toThrowError(/Label other referenced before defined/);
  });
  it("should work for transitive references", () => {
    // This has the same elements as `should fail if the order is wrong`
    // but with the proper order.
    const bundleList: ContractBundleList<undefined> = {
      main: "main",
      bundle: [
        { label: "other", type: "contract", value: "close" },
        {
          label: "main",
          type: "contract",
          value: {
            pay: 1n,
            token: lovelace,
            from_account: aParty,
            to: { party: aParty },
            then: { ref: "other" },
          },
        },
      ],
    };
    const bundleMap = bundleListToMap(bundleList);
    expect(bundleMap).toEqual({
      main: "main",
      objects: {
        main: {
          type: "contract",
          value: {
            pay: 1n,
            token: lovelace,
            from_account: aParty,
            to: { party: aParty },
            then: { ref: "other" },
          },
        },
        other: { type: "contract", value: "close" },
      },
    });
  });

  it("should fail if an element is defined twice", () => {
    const bundleList: ContractBundleList<undefined> = {
      main: "main",
      bundle: [
        { label: "main", type: "contract", value: "close" },
        { label: "main", type: "contract", value: "close" },
      ],
    };
    expect(() => bundleListToMap(bundleList)).toThrowError(/already defined/);
  });
  it("should fail when there is an object type mistmatch", () => {
    const bundleList: ContractBundleList<undefined> = {
      main: "main",
      bundle: [
        {
          label: "main",
          type: "party",
          value: aParty,
        },
      ],
    };
    expect(() => bundleListToMap(bundleList)).toThrowError(/Expected main to be a contract but got party instead/);
  });
  it("should fail when there is a contract circular dependency", () => {
    const bundleList: ContractBundleList<undefined> = {
      main: "main",
      bundle: [
        {
          label: "other",
          type: "contract",
          value: {
            pay: 1n,
            token: lovelace,
            from_account: aParty,
            to: { party: aParty },
            then: { ref: "main" },
          },
        },
        {
          label: "main",
          type: "contract",
          value: {
            pay: 1n,
            token: lovelace,
            from_account: aParty,
            to: { party: aParty },
            then: { ref: "other" },
          },
        },
      ],
    };
    expect(() => bundleListToMap(bundleList)).toThrowError(/Circular dependency/i);
  });
  it("should fail when there is a value circular dependency", () => {
    const bundleList: ContractBundleList<undefined> = {
      main: "main",
      bundle: [
        {
          label: "v2",
          type: "value",
          value: {
            add: 1n,
            and: { ref: "v1" },
          },
        },
        {
          label: "v1",
          type: "value",
          value: {
            add: 1n,
            and: { ref: "v2" },
          },
        },
        {
          label: "main",
          type: "contract",
          value: {
            pay: { ref: "v1" },
            token: lovelace,
            from_account: aParty,
            to: { party: aParty },
            then: "close",
          },
        },
      ],
    };
    expect(() => bundleListToMap(bundleList)).toThrowError(/Circular dependency/i);
  });
  it("should fail when there is an observation circular dependency", () => {
    const bundleList: ContractBundleList<undefined> = {
      main: "main",
      bundle: [
        {
          label: "o2",
          type: "observation",
          value: {
            both: true,
            and: { ref: "o1" },
          },
        },
        {
          label: "o1",
          type: "observation",
          value: {
            both: true,
            and: { ref: "o2" },
          },
        },
        {
          label: "main",
          type: "contract",
          value: {
            assert: { ref: "o1" },
            then: "close",
          },
        },
      ],
    };
    expect(() => bundleListToMap(bundleList)).toThrowError(/Circular dependency/i);
  });
});
