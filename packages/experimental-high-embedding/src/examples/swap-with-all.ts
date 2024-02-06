import {
  All,
  Close,
  SetContingency,
  token,
  When,
  Do,
  Party,
  SingleAssetValue,
  ada,
  Address,
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
  deadline: new Date("2024-05-26T12:00:00.000Z"),
  partyA: Address(
    "addr_test1qpcucug827nlrmsv7n66hwdfpemwqtv8nxnjc4azacuu807w6l6hgelwsph7clqmauq7h3y9qhhgs0rwu3mu8uf7m4kqckxkry"
  ),
  partyB: Address(
    "addr_test1qr5xmx2uk4mdllmcmvvzrv0dgjqdcq6vwrlapkhs53y26frd865gqhw8qxh53gnhnc3gsrgz2nc7gackeneut4ctjgvs207cpv"
  ),
  assetA: [
    1,
    token(
      "6fcbab5bb175b420cd060edb63af74c5b3d4687163f282ddc5377dd3",
      "SurveyReward"
    ),
  ],
  assetB: [100, ada],
});

console.log(s.getRuntimeObject());
