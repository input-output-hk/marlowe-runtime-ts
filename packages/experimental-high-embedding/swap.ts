import {
  Close,
  Party,
  Role,
  SetContingency,
  SingleAssetValue,
  Token,
  ValueOrNumber,
  When,
  token,
} from "./marlowe";

interface SwapRequest {
  partyA: Party;
  assetsA: SingleAssetValue;
  partyB: Party;
  assetsB: SingleAssetValue;
  deadline: Date;
}

function swap({ partyA, partyB, assetsA, assetsB, deadline }: SwapRequest) {
  return SetContingency(
    When([
      partyA
        .deposits(assetsA)
        .intoAccount(partyA)
        .then(
          When([
            partyB
              .deposits(assetsB)
              .intoAccount(partyB)
              .then(
                partyA
                  .payOut(assetsA)
                  .to(partyB)
                  .then(partyB.payOut(assetsB).to(partyA).then(Close))
              ),
          ])
        ),
    ])
  ).after(deadline, Close);
}

const s = swap({
  deadline: new Date("2023-05-26T12:34:56.789Z"),
  partyA: Role("partyA"),
  assetsA: [5, token("symA", "tokA")],
  partyB: Role("partyB"),
  assetsB: [100, token("symB", "tokB")],
});

console.log(s.stringify());
