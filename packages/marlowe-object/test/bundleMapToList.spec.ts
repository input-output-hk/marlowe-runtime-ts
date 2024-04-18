import { bundleMapToList, ContractBundleMap, lovelace, Party } from "@marlowe.io/marlowe-object";

describe("bundleMapToList", () => {
  const aParty: Party = { address: "test1234" };

  it("should work for trivial bundle", () => {
    const bundleMap: ContractBundleMap<undefined> = {
      main: "main",
      objects: { main: { type: "contract", value: "close" } },
    };
    const bundleList = bundleMapToList(bundleMap);
    expect(bundleList).toEqual({
      main: "main",
      bundle: [{ type: "contract", value: "close", label: "main" }],
    });
  });

  it("should work for all types", () => {
    const bundleMap: ContractBundleMap<undefined> = {
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
    };
    const bundleList = bundleMapToList(bundleMap);
    expect(bundleList).toEqual({
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
    });
  });

  it("should fail when the main reference is missing", () => {
    const bundleMap: ContractBundleMap<undefined> = {
      main: "main",
      objects: { other: { type: "contract", value: "close" } },
    };
    expect(() => bundleMapToList(bundleMap)).toThrowError(/Missing label main/);
  });

  it("should fail when a transitive reference is missing", () => {
    const bundleMap: ContractBundleMap<undefined> = {
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
      },
    };
    expect(() => bundleMapToList(bundleMap)).toThrowError(/Missing label other/);
  });

  it("should fail when there is a contract circular dependency", () => {
    const bundleMap: ContractBundleMap<undefined> = {
      main: "main",
      objects: {
        other: {
          type: "contract",
          value: {
            pay: 1n,
            token: lovelace,
            from_account: aParty,
            to: { party: aParty },
            then: { ref: "main" },
          },
        },
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
      },
    };
    expect(() => bundleMapToList(bundleMap)).toThrowError(/Circular dependency/);
  });

  it("should fail when there is an object type mistmatch", () => {
    const bundleMap: ContractBundleMap<undefined> = {
      main: "main",
      objects: {
        main: {
          type: "party",
          value: aParty,
        },
      },
    };
    expect(() => bundleMapToList(bundleMap)).toThrowError(/Expected main to be a contract but got party instead/);
  });

  it("should fail when there is a value circular dependency", () => {
    const bundleMap: ContractBundleMap<undefined> = {
      main: "main",
      objects: {
        v2: {
          type: "value",
          value: {
            add: 1n,
            and: { ref: "v1" },
          },
        },
        v1: {
          type: "value",
          value: {
            add: 1n,
            and: { ref: "v2" },
          },
        },
        main: {
          type: "contract",
          value: {
            pay: { ref: "v1" },
            token: lovelace,
            from_account: aParty,
            to: { party: aParty },
            then: "close",
          },
        },
      },
    };
    expect(() => bundleMapToList(bundleMap)).toThrowError(/Circular dependency/);
  });

  it("should fail when there is an observation circular dependency", () => {
    const bundleMap: ContractBundleMap<undefined> = {
      main: "main",
      objects: {
        o2: {
          type: "observation",
          value: {
            both: true,
            and: { ref: "o1" },
          },
        },
        o1: {
          type: "observation",
          value: {
            both: true,
            and: { ref: "o2" },
          },
        },
        main: {
          type: "contract",
          value: {
            assert: { ref: "o1" },
            then: "close",
          },
        },
      },
    };
    expect(() => bundleMapToList(bundleMap)).toThrowError(/Circular dependency/);
  });
});
