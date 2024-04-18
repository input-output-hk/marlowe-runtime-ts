/**
 * Create a {@link api.WalletAPI} from a Lucid wallet instance that can work both in the
 * backend (Node.js/Deno) and in the browser
  ```
    import { mkLucidWallet } from "@marlowe.io/wallet/lucid";
    import { Lucid, Blockfrost } from "lucid-cardano";

    const lucid = await Lucid.new(
      new Blockfrost(config.blockfrostUrl, config.blockfrostProjectId),
      config.network
    );
    lucid.selectWalletFromSeed(config.seedPhrase);

    const wallet = mkLucidWallet(lucid);
  ```
 * @packageDocumentation
 */
import { C, Lucid, Unit, fromUnit, fromHex, toHex, Assets as LucidAssets } from "lucid-cardano";

import { WalletAPI } from "../api.js";
import * as runtimeCore from "@marlowe.io/runtime-core";
import * as Codec from "@47ng/codec";
import { pipe } from "fp-ts/lib/function.js";
import * as A from "fp-ts/lib/Array.js";
import * as R from "fp-ts/lib/Record.js";
import { mergeAssets } from "@marlowe.io/adapter/lucid";
import { addressBech32, MarloweTxCBORHex, txOutRef } from "@marlowe.io/runtime-core";
type LucidDI = { lucid: Lucid };

const getAssetName: (unit: Unit) => string = (unit) => {
  const assetName = fromUnit(unit).assetName;
  return assetName ? Codec.hexToUTF8(assetName) : "";
};

const getAddress =
  ({ lucid }: LucidDI) =>
  () =>
    lucid.wallet.address().then(addressBech32);

// NOTE: This function may report a different amount of lovelaces than
//       a CIP-30 wallet, as this can't take into account the collateral
//       UTxO.
const getTokens =
  ({ lucid }: LucidDI) =>
  async (): Promise<runtimeCore.Token[]> => {
    const utxos = await lucid.wallet.getUtxos();

    return pipe(
      utxos, // UTxO[]
      A.map((utxo) => utxo.assets), // LucidAssets[]
      A.reduce(mergeAssets.empty, mergeAssets.concat), // LucidAssets
      R.toEntries, // Array<[string, bigint]>
      A.map(([unit, quantity]) => {
        if (unit === "lovelace") {
          return runtimeCore.lovelaces(quantity);
        } else {
          return runtimeCore.token(quantity)(
            runtimeCore.assetId(runtimeCore.policyId(fromUnit(unit).policyId))(getAssetName(unit))
          );
        }
      })
    );
  };

const signTx =
  ({ lucid }: LucidDI) =>
  async (cborHex: MarloweTxCBORHex) => {
    const tx = C.Transaction.from_bytes(fromHex(cborHex));
    try {
      const txSigned = await lucid.wallet.signTx(tx);
      return toHex(txSigned.to_bytes());
    } catch (reason) {
      throw new Error(`Error while signing : ${reason}`);
    }
  };
const getLovelaces =
  ({ lucid }: LucidDI) =>
  async (): Promise<bigint> => {
    const tokens = await getTokens({ lucid })();
    return pipe(
      tokens,
      A.filter((token) => runtimeCore.isLovelace(token.assetId)),
      A.reduce(0n, (acc, token) => acc + token.quantity)
    );
  };

const getUTXOs =
  ({ lucid }: LucidDI) =>
  async () => {
    const utxos = await lucid.wallet.getUtxos();
    return utxos.map((utxo) => txOutRef(utxo.txHash));
  };
const isMainnet =
  ({ lucid }: LucidDI) =>
  async () => {
    return lucid.network == "Mainnet";
  };

const waitConfirmation =
  ({ lucid }: LucidDI) =>
  async (txHash: string) => {
    try {
      return await lucid.awaitTx(txHash);
    } catch (reason) {
      throw new Error(`Error while awiting : ${reason}`);
    }
  };
/**
 * @inheritdoc lucid
 */
export function mkLucidWallet(lucidWallet: Lucid): WalletAPI {
  const di = { lucid: lucidWallet };
  return {
    waitConfirmation: waitConfirmation(di),
    signTx: signTx(di),
    getChangeAddress: getAddress(di),
    getUsedAddresses: () => getAddress(di)().then((address) => [address]),
    // NOTE: As far as I've seen Lucid doens't support collateral UTxOs
    getCollaterals: () => Promise.resolve([]),
    getUTxOs: getUTXOs(di),
    isMainnet: isMainnet(di),
    getTokens: getTokens(di),
    getLovelaces: getLovelaces(di),
  };
}
