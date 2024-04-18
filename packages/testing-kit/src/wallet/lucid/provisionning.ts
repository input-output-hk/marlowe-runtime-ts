import { Lucid, toUnit, fromText, NativeScript, Script, Assets as LucidAssets } from "lucid-cardano";
import { addDays } from "date-fns";

import { mergeAssets } from "@marlowe.io/adapter/lucid";

import * as RuntimeCore from "@marlowe.io/runtime-core";
import { pipe } from "fp-ts/lib/function.js";
import * as A from "fp-ts/lib/Array.js";
import { MarloweJSON } from "@marlowe.io/adapter/codec";
import { logDebug, logInfo } from "../../logging.js";

import { WalletTestDI, mkLucidWalletTest } from "./index.js";
import { ProvisionRequest, ProvisionResponse, ProvisionScheme, WalletTestAPI } from "../api.js";

type RequestWithWallets = {
  [participant: string]: {
    wallet: WalletTestAPI;
    scheme: ProvisionScheme;
  };
};

/**
 * `provision` implmentation using a Lucid instance
 * @param di
 * @returns
 * @hidden
 */
export const provision =
  (di: WalletTestDI) =>
  async (request: ProvisionRequest): Promise<ProvisionResponse> => {
    if (Object.entries(request).length === 0) {
      logInfo("No Participants Involved");
      return Promise.resolve({});
    }
    const { lucid, wallet } = di;
    let requestWithWallets: RequestWithWallets = {};
    await Promise.all(
      Object.entries(request).map(([participant, { walletSeedPhrase, scheme }]) => {
        return Lucid.new(lucid.provider, lucid.network).then((newLucidInstance) => {
          const wallet = mkLucidWalletTest(newLucidInstance.selectWalletFromSeed(walletSeedPhrase.join(` `)));
          requestWithWallets[participant] = { wallet, scheme };
        });
      })
    );

    logInfo(`Provisionning Request : ${MarloweJSON.stringify(requestWithWallets, null, 4)}`);

    const mintingDeadline = addDays(Date.now(), 1);

    const [script, policyId] = await mkPolicyWithDeadlineAndOneAuthorizedSigner(di)(mintingDeadline);

    const distributions = await Promise.all(
      Object.entries(requestWithWallets).map(([participant, x]) =>
        x.wallet.getChangeAddress().then(
          (address) =>
            [
              participant,
              x.wallet,
              RuntimeCore.addressBech32(address),
              {
                lovelaces: x.scheme.lovelacesToTransfer,
                tokens: Object.entries(x.scheme.assetsToMint).map(([assetName, quantity]) => ({
                  quantity,
                  assetId: { assetName, policyId },
                })),
              },
            ] as [string, WalletTestAPI, RuntimeCore.AddressBech32, RuntimeCore.Assets]
        )
      )
    );

    const assetsToMint = pipe(
      distributions,
      A.map((aDistribution) => toAssetsToMint(aDistribution[3])),
      A.reduce(mergeAssets.empty, mergeAssets.concat)
    );

    logDebug(`Distribution : ${MarloweJSON.stringify(distributions, null, 4)}`);
    logDebug(`Assets to mint : ${MarloweJSON.stringify(assetsToMint, null, 4)}`);

    const mintTx = lucid
      .newTx()
      .mintAssets(assetsToMint)
      .validTo(Date.now() + 100000)
      .attachMintingPolicy(script);

    const transferTx = await pipe(
      distributions,
      A.reduce(
        lucid.newTx(),
        (tx, aDistribution) =>
          tx
            .payToAddress(aDistribution[2], toAssetsToTransfer(aDistribution[3]))
            .payToAddress(aDistribution[2], { lovelace: 5_000_000n })
            .payToAddress(aDistribution[2], { lovelace: 5_000_000n })
            .payToAddress(aDistribution[2], { lovelace: 5_000_000n }) // add a Collateral
      )
    );
    const result: ProvisionResponse = Object.fromEntries(
      distributions.map(([participant, wallet, , assetsProvisioned]) => [participant, { wallet, assetsProvisioned }])
    );

    logDebug(`result : ${MarloweJSON.stringify(result, null, 4)}`);
    const provisionTx = await mintTx.compose(transferTx).complete();

    await provisionTx
      .sign()
      .complete()
      .then((tx) => tx.submit())
      .then((txHashSubmitted) => wallet.waitConfirmation(txHashSubmitted));
    return result;
  };

const mkPolicyWithDeadlineAndOneAuthorizedSigner =
  ({ lucid }: WalletTestDI) =>
  async (deadline: Date): Promise<[Script, RuntimeCore.PolicyId]> => {
    const { paymentCredential } = lucid.utils.getAddressDetails(await lucid.wallet.address());
    const json: NativeScript = {
      type: "all",
      scripts: [
        {
          type: "before",
          slot: lucid.utils.unixTimeToSlot(deadline.valueOf()),
        },
        { type: "sig", keyHash: paymentCredential?.hash! },
      ],
    };
    const script = lucid.utils.nativeScriptFromJson(json);
    const policyId = lucid.utils.mintingPolicyToId(script);
    return [script, RuntimeCore.policyId(policyId)];
  };

const toAssetsToTransfer = (assets: RuntimeCore.Assets): LucidAssets => {
  var lucidAssets: { [key: string]: bigint } = {};
  lucidAssets["lovelace"] = assets.lovelaces;
  assets.tokens.map(
    (token) => (lucidAssets[toUnit(token.assetId.policyId, fromText(token.assetId.assetName))] = token.quantity)
  );
  return lucidAssets;
};

const toAssetsToMint = (assets: RuntimeCore.Assets): LucidAssets => {
  var lucidAssets: { [key: string]: bigint } = {};
  assets.tokens.map(
    (token) => (lucidAssets[toUnit(token.assetId.policyId, fromText(token.assetId.assetName))] = token.quantity)
  );
  return lucidAssets;
};
