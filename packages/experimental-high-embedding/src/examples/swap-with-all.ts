import {
  All,
  Close,
  Role,
  SetContingency,
  token,
  When,
  Do,
  Party,
  SingleAssetValue,
} from "../index.js";

interface SwapRequest {
  partyA: Party;
  assetA: SingleAssetValue;
  partyB: Party;
  assetB: SingleAssetValue;
  deadline: Date;
}

const swap = ({ partyA, partyB, assetA, assetB, deadline }: SwapRequest) =>
  SetContingency(
    When(
      All(
        [
          partyA.deposits(assetA).intoAccount(partyA),
          partyB.deposits(assetB).intoAccount(partyB),
        ],
        Do(
          partyA.payOut(assetA).to(partyB),
          partyB.payOut(assetB).to(partyA),
          Close
        )
      )
    )
  ).after(deadline, Close);

const s = swap({
  deadline: new Date("2023-05-26T12:34:56.789Z"),
  partyA: Role("partyA"),
  partyB: Role("partyB"),
  assetA: [5, token("symA", "tokA")],
  assetB: [100, token("symB", "tokB")],
});

console.log(s.getRuntimeObject());
