import { toUnit, fromText, NativeScript, Script, Assets as LucidAssets } from "lucid-cardano";
import { addDays } from "date-fns";

import { mergeAssets } from "@marlowe.io/adapter/lucid";

import * as RuntimeCore from "@marlowe.io/runtime-core";
import { pipe } from "fp-ts/lib/function.js";
import * as A from "fp-ts/lib/Array.js";
import { logDebug, logInfo, safeStringify } from "../../logging.js";

import { DAppWalletAPI, ProvisionRequest, ProvisionResponse, ProvisionScheme } from "../api.js";
import { RestClient } from "@marlowe.io/runtime-rest-client";
import { LucidBasedWallet, mkLucidBasedWallet } from "@marlowe.io/wallet/lucid";
import { sleep, waitForPredicatePromise } from "@marlowe.io/adapter/time";

type RequestWithWallets = {
  [participant: string]: {
    wallet: LucidBasedWallet;
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
  (runtimeClient: RestClient, sponsor: LucidBasedWallet) =>
  async (request: ProvisionRequest): Promise<ProvisionResponse> => {
    if (Object.entries(request).length === 0) {
      logInfo("No Participants Involved");
      return Promise.resolve({});
    }
    let requestWithWallets: RequestWithWallets = {};
    await Promise.all(
      Object.entries(request).map(async ([participant, { walletSeedPhrase, scheme }]) => {
        const wallet = await mkLucidBasedWallet(sponsor.lucid.provider, sponsor.lucid.network, walletSeedPhrase.join(` `));
        requestWithWallets[participant] = { wallet, scheme };
      })
    );
    const mintingDeadline = addDays(Date.now(), 1);
    const [script, policyId] = await mkPolicyWithDeadlineAndOneAuthorizedSigner(sponsor)(mintingDeadline);
    const distributions = await Promise.all(
      Object.entries(requestWithWallets).map(([participant, x]) =>
        x.wallet.getChangeAddress().then(
          (address: string) => {
            return [
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
            ] as [string, LucidBasedWallet, RuntimeCore.AddressBech32, RuntimeCore.Assets]
        })
      )
    );

    const assetsToMint = pipe(
      distributions,
      A.map((aDistribution) => toAssetsToMint(aDistribution[3])),
      A.reduce(mergeAssets.empty, mergeAssets.concat)
    );

    logDebug(`Distribution : ${safeStringify(distributions, 4)}`);
    logDebug(`Assets to mint : ${safeStringify(assetsToMint, 4)}`);

    const mintTx = sponsor
      .lucid
      .newTx()
      .mintAssets(assetsToMint)
      .validTo(Date.now() + 100000)
      .attachMintingPolicy(script);

    const transferTx = pipe(
      distributions,
      A.reduce(
        sponsor.lucid.newTx(),
        (tx, aDistribution) =>
          tx
            .payToAddress(aDistribution[2], toAssetsToTransfer(aDistribution[3]))
            .payToAddress(aDistribution[2], { lovelace: 5_000_000n })
            .payToAddress(aDistribution[2], { lovelace: 5_000_000n })
            .payToAddress(aDistribution[2], { lovelace: 5_000_000n }) // add a Collateral
      )
    );
    const result: ProvisionResponse = await (async () => {
      const entries = await Promise.all(distributions.map(async ([participant, lucidBasedWallet, , assetsProvisioned]) => {
        const wallet = await mkDAppWallet(lucidBasedWallet)(runtimeClient);
        return [participant, { wallet, assetsProvisioned }];
      }));
      return Object.fromEntries(entries);
    })();

    logDebug(`Provision response: ${safeStringify(result, 4)}`);
    const provisionTx = await mintTx.compose(transferTx).complete();

    await provisionTx
      .sign()
      .complete()
      .then((tx) => tx.submit())
      .then((txHashSubmitted: string) => sponsor.waitConfirmation(txHashSubmitted));
    return result;
  };

const mkPolicyWithDeadlineAndOneAuthorizedSigner =
  (sponsor: LucidBasedWallet) =>
  async (deadline: Date): Promise<[Script, RuntimeCore.PolicyId]> => {
    const address = await sponsor.lucid.wallet.address();
    const { paymentCredential } = sponsor.lucid.utils.getAddressDetails(address);
    const json: NativeScript = {
      type: "all",
      scripts: [
        {
          type: "before",
          slot: sponsor.lucid.utils.unixTimeToSlot(deadline.valueOf()),
        },
        { type: "sig", keyHash: paymentCredential?.hash! },
      ],
    };
    const script = sponsor.lucid.utils.nativeScriptFromJson(json);
    const policyId = sponsor.lucid.utils.mintingPolicyToId(script);
    return [script, RuntimeCore.policyId(policyId)];
  };

const toAssetsToTransfer = (assets: RuntimeCore.Assets): LucidAssets => {
  var lucidAssets: { [key: string]: bigint } = {};
  lucidAssets["lovelace"] = assets.lovelaces ?? 0n;
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


/** TODO: paluh
 * `mkDAppWallet` implementation using a Lucid Wallet
 * @remarks
 * This implementation is approximative because we are waiting for the runtime chain to sync and
 * not the runtime itself. The Runtime doesn't provide a tip representing the last slot read but
 * it provides the last slot where a contract Tx activity has been read.
 * We are adding a sleep at the end, to artificially wait the runtime to sync on a synced Runtime Chain.
 * @param client
 * @param aSlotNo
 * @returns
 * @hidden
 */
const mkDAppWallet =
  (wallet: LucidBasedWallet) =>
  async (client: RestClient): Promise<DAppWalletAPI> => {
    logInfo("Waiting for Runtime to sync with the Wallet");
    const currentLucidSlot = BigInt(wallet.lucid.currentSlot());
    logInfo(`Setting up a synchronization point with Runtime at slot  ${currentLucidSlot}`);
    await waitForPredicatePromise(isRuntimeChainMoreAdvancedThan(client, currentLucidSlot));
    logInfo(`Runtime and Wallet passed both ${currentLucidSlot} slot.`);
    // This sleep will be removed when we have a better tip for runtime...
    sleep(20);
    return {...wallet, restClient: client};
  };

/**
 * Predicate that verify is the Runtime Chain Tip >= to a givent slot
 * @param client
 * @param aSlotNo
 * @returns
 */
export const isRuntimeChainMoreAdvancedThan = (client: RestClient, aSlotNo: bigint) => () =>
  client.healthcheck().then((status) => {
    logDebug(`Runtime Chain Tip SlotNo : ${status.tips.runtimeChain.blockHeader.slotNo}`);
    logDebug(`Wallet Chain Tip SlotNo  : ${aSlotNo}`);
    if (status.tips.runtimeChain.blockHeader.slotNo >= aSlotNo) {
      return true;
    } else {
      const delta = aSlotNo - status.tips.runtimeChain.blockHeader.slotNo;
      logDebug(`Waiting Runtime to reach that point (${delta} slots behind (~${delta}s)) `);
      return false;
    }
  });
