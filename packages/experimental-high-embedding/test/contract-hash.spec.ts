// TODO: Fix imports not to use dist
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
  Do,
  waitFor,
} from "../dist/esm/index.js";

describe("Contract hashing", () => {
  it("Different instances of the same contract are hashed the same", () => {
    const partyA = Role("partyA");
    const partyB = Role("partyB");
    const c1 = When([
      partyA
        .deposits([5, token("symA", "tokA")])
        .intoAccount(partyB)
        .then(Close),
    ]);
    const c2 = Do(
      waitFor(partyA.deposits([5, token("symA", "tokA")]).intoAccount(partyB)),
      Close
    );
    expect(c1).not.toBe(c2);
    expect(c1.hash()).toBe(c2.hash());
  });
  it("Different instances of the same contract are hashed the same 2", () => {
    const partyA = Role("partyA");
    const partyB = Role("partyB");
    const c1 = When([
      partyA
        .deposits([5, token("symA", "tokA")])
        .intoAccount(partyB)
        .then(
          partyB
            .payOut([Add(3, 2n), token("symA", "tokA")])
            .to(partyA)
            .then(Close)
        ),
    ]);
    const c2 = Do(
      waitFor(partyA.deposits([5, token("symA", "tokA")]).intoAccount(partyB)),
      partyB.payOut([Add(3, 2n), token("symA", "tokA")]).to(partyA),
      Close
    );
    expect(c1).not.toBe(c2);
    expect(c1.hash()).toBe(c2.hash());
  });
});
