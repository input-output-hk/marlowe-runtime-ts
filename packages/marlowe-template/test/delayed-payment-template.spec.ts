import { AddressBech32, addressBech32 } from "@marlowe.io/runtime-core";
import { TemplateParametersOf, mkMarloweTemplate } from "@marlowe.io/marlowe-template";
describe("Delayed payment Template", () => {
  const delayPaymentTemplate = mkMarloweTemplate({
    name: "Delayed payment",
    description:
      "In a delay payment, a `payer` transfer an `amount` of ADA to the `payee` which can be redeemed after a `releaseDeadline`. While the payment is held by the contract, it can be staked to the payer, to generate pasive income while the payee has the guarantees that the money will be released.",
    params: [
      {
        name: "payer",
        description: "Who is making the payment",
        type: "address",
      },
      {
        name: "payee",
        description: "Who is receiving the payment",
        type: "address",
      },
      {
        name: "amount",
        description: "The amount of lovelaces to be paid",
        type: "value",
      },
      {
        name: "depositDeadline",
        description:
          "The deadline for the payment to be made. If the payment is not made by this date, the contract can be closed",
        type: "date",
      },
      {
        name: "releaseDeadline",
        description:
          "A date after the payment can be released to the receiver. NOTE: An empty transaction must be done to close the contract",
        type: "date",
      },
    ] as const,
  });

  /** The inferred type should be
    {
      payer: AddressBech32,
      payee: AddressBech32,
      amount: BigInt,
      depositDeadline: Date,
      releaseDeadline: Date
    }
   */
  type DelayedPaymentParams = TemplateParametersOf<typeof delayPaymentTemplate>;

  const aDepositDate = new Date("2024-01-01T00:00:00.000Z");
  const aDepositDateMS = BigInt(aDepositDate.getTime());

  const aReleaseDate = new Date("2024-01-02T00:00:00.000Z");
  const aReleaseDateMS = BigInt(aReleaseDate.getTime());

  it("should guard for correct values", () => {
    const a: DelayedPaymentParams = {
      payer: addressBech32(
        "addr_test1qpcucug827nlrmsv7n66hwdfpemwqtv8nxnjc4azacuu807w6l6hgelwsph7clqmauq7h3y9qhhgs0rwu3mu8uf7m4kqckxkry"
      ),
      payee: addressBech32(
        "addr_test1qr5xmx2uk4mdllmcmvvzrv0dgjqdcq6vwrlapkhs53y26frd865gqhw8qxh53gnhnc3gsrgz2nc7gackeneut4ctjgvs207cpv"
      ),
      amount: 42n,
      depositDeadline: aDepositDate,
      releaseDeadline: aReleaseDate,
    };

    expect(delayPaymentTemplate.is(a)).toBe(true);
  });

  it("should guard for incorrect addresses", () => {
    const a: DelayedPaymentParams = {
      payer: "invalid_address" as AddressBech32,
      payee: "invalid_address" as AddressBech32,
      amount: 42n,
      depositDeadline: aDepositDate,
      releaseDeadline: aReleaseDate,
    };

    expect(delayPaymentTemplate.is(a)).toBe(false);
  });
  it("should encode a valid value", () => {
    const a: DelayedPaymentParams = {
      payer: addressBech32(
        "addr_test1qpcucug827nlrmsv7n66hwdfpemwqtv8nxnjc4azacuu807w6l6hgelwsph7clqmauq7h3y9qhhgs0rwu3mu8uf7m4kqckxkry"
      ),
      payee: addressBech32(
        "addr_test1qr5xmx2uk4mdllmcmvvzrv0dgjqdcq6vwrlapkhs53y26frd865gqhw8qxh53gnhnc3gsrgz2nc7gackeneut4ctjgvs207cpv"
      ),
      amount: 42n,
      depositDeadline: aDepositDate,
      releaseDeadline: aReleaseDate,
    };
    expect(delayPaymentTemplate.toMetadata(a)).toEqual({
      "9041": {
        v: 1n,
        params: [
          [
            "addr_test1qpcucug827nlrmsv7n66hwdfpemwqtv8nxnjc4azacuu807w6l6hge",
            "lwsph7clqmauq7h3y9qhhgs0rwu3mu8uf7m4kqckxkry",
          ],
          [
            "addr_test1qr5xmx2uk4mdllmcmvvzrv0dgjqdcq6vwrlapkhs53y26frd865gqh",
            "w8qxh53gnhnc3gsrgz2nc7gackeneut4ctjgvs207cpv",
          ],
          42n,
          aDepositDateMS,
          aReleaseDateMS,
        ],
      },
    });
  });
  it("should decode a valid value", () => {
    const metadata = {
      "9041": {
        v: 1n,
        params: [
          [
            "addr_test1qpcucug827nlrmsv7n66hwdfpemwqtv8nxnjc4azacuu807w6l6hge",
            "lwsph7clqmauq7h3y9qhhgs0rwu3mu8uf7m4kqckxkry",
          ],
          [
            "addr_test1qr5xmx2uk4mdllmcmvvzrv0dgjqdcq6vwrlapkhs53y26frd865gqh",
            "w8qxh53gnhnc3gsrgz2nc7gackeneut4ctjgvs207cpv",
          ],
          42n,
          aDepositDateMS,
          aReleaseDateMS,
        ],
      },
    };

    expect(delayPaymentTemplate.fromMetadata(metadata)).toEqual({
      payer: addressBech32(
        "addr_test1qpcucug827nlrmsv7n66hwdfpemwqtv8nxnjc4azacuu807w6l6hgelwsph7clqmauq7h3y9qhhgs0rwu3mu8uf7m4kqckxkry"
      ),
      payee: addressBech32(
        "addr_test1qr5xmx2uk4mdllmcmvvzrv0dgjqdcq6vwrlapkhs53y26frd865gqhw8qxh53gnhnc3gsrgz2nc7gackeneut4ctjgvs207cpv"
      ),
      amount: 42n,
      depositDeadline: aDepositDate,
      releaseDeadline: aReleaseDate,
    });
  });

  it("should fail to decode an invalid address", () => {
    const metadata = {
      "9041": {
        v: 1n,
        params: [
          ["invalid_address"],
          [
            "addr_test1qr5xmx2uk4mdllmcmvvzrv0dgjqdcq6vwrlapkhs53y26frd865gqh",
            "w8qxh53gnhnc3gsrgz2nc7gackeneut4ctjgvs207cpv",
          ],
          42n,
          aDepositDateMS,
          aReleaseDateMS,
        ],
      },
    };
    // FIXME: Improve the error message checking
    expect(() => delayPaymentTemplate.fromMetadata(metadata)).toThrow();
  });
});
