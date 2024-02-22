import {
  Close,
  Do,
  Party,
  Role,
  SetContingency,
  SingleAssetValue,
  token,
  When,
} from "../index.js";

interface SwapRequest {
  partyA: Party;
  assetA: SingleAssetValue;
  partyB: Party;
  assetB: SingleAssetValue;
  deadline: Date;
}
// TODO: Rename Merkle-swap as we are not using Merkle abstraction anymore,
//       maybe refactor into a referenced contract.
function swap({ partyA, partyB, assetA, assetB, deadline }: SwapRequest) {
  const makeSwap = Do(
    partyA.payOut(assetA).to(partyB),
    partyB.payOut(assetB).to(partyA),
    Close
  );
  return SetContingency(
    When([
      partyA
        .deposits(assetA)
        .intoAccount(partyA)
        .then(
          When([partyB.deposits(assetB).intoAccount(partyB).then(makeSwap)])
        ),
      partyB
        .deposits(assetB)
        .intoAccount(partyB)
        .then(
          When([partyA.deposits(assetA).intoAccount(partyA).then(makeSwap)])
        ),
    ])
  ).after(deadline, Close);
}

const s = swap({
  deadline: new Date("2023-05-26T12:34:56.789Z"),
  partyA: Role("partyA"),
  partyB: Role("partyB"),
  assetA: [5, token("symA", "tokA")],
  assetB: [100, token("symB", "tokB")],
});

console.log(s.getRuntimeObject());
