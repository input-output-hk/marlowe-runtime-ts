import {
  Close,
  Do,
  Party,
  Role,
  SetContingency,
  SingleAssetValue,
  token,
  waitFor,
} from "../index.js";

interface SwapRequest {
  partyA: Party;
  assetA: SingleAssetValue;
  partyB: Party;
  assetB: SingleAssetValue;
  deadline: Date;
}

function swap({ partyA, partyB, assetA, assetB, deadline }: SwapRequest) {
  return SetContingency(
    Do(
      waitFor(partyA.deposits(assetA).intoAccount(partyA)),
      waitFor(partyB.deposits(assetB).intoAccount(partyB)),
      partyA.payOut(assetA).to(partyB),
      partyB.payOut(assetB).to(partyA),
      Close
    )
  ).after(deadline, Close);
}

const s = swap({
  deadline: new Date("2023-05-26T12:34:56.789Z"),
  partyA: Role("partyA"),
  assetA: [5, token("symA", "tokA")],
  partyB: Role("partyB"),
  assetB: [100, token("symB", "tokB")],
});

console.log(s.stringify());
