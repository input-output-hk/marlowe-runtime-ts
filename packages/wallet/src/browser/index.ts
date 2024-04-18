import { WalletAPI } from "../api.js";
import { C } from "lucid-cardano";
import * as t from "io-ts/lib/index.js";
import * as Lucid from "lucid-cardano";
import { hex, utf8 } from "@47ng/codec";
import { assertGuardEqual, proxy } from "@marlowe.io/adapter/io-ts";
// DISCUSSION: these should be imported from a cardano helpers library.
//       They are independent of the runtime. Maybe the adaptor library?
import {
  AddressBech32,
  TxOutRef,
  addressBech32,
  txOutRef,
  Token,
  token,
  lovelaces,
  assetId,
  policyId,
  unTxOutRef,
} from "@marlowe.io/runtime-core";

/**
 * The SupportedWalletName is the list of Known and tested Browser Cardano Wallet Extensions supporting building/signing Marlowe Transactions.
 */
export type SupportedWalletName = "nami" | "eternl" | "lace";

export const SupportedWalletNameGuard: t.Type<SupportedWalletName> = assertGuardEqual(
  proxy<SupportedWalletName>(),
  t.union([t.literal("nami"), t.literal("eternl"), t.literal("lace")])
);

/**
 * The BroswerWalletExtension is an interface for interacting with a querying the list of Browser Cardano Wallet Extensions.
 */
export type BroswerWalletExtension = {
  /**
   * The name of the wallet behind the browser extension
   */
  name: string;
  /**
   * icon of the extension
   */
  icon: string;
  /**
   * Version of the extension
   */
  apiVersion: string;
  /**
   * Indicates if the extension supports building/signing Marlowe Transactions or not.
   */
  supported: boolean;
};

/**
 * Get a list of the Wallet Extensions installed in the browser
 */
export function getInstalledWalletExtensions(): BroswerWalletExtension[] {
  if ("cardano" in window) {
    // NOTE: it would be nice to have a Type assertion that the supportedWallets array is
    // the same as the SupportedWallets type union. I've tried the other way (infering the type
    // from the array) but the exported documentation doesn't look good
    const supportedWallets = ["nami", "eternl", "lace"];
    return Object.values(window.cardano)
      .filter((entry) => "apiVersion" in entry)
      .map((walletAPI) => ({
        name: walletAPI.name,
        icon: walletAPI.icon,
        apiVersion: walletAPI.apiVersion,
        supported: supportedWallets.includes(walletAPI.name.toLowerCase()),
      }));
  } else {
    return [];
  }
}

type ExtensionDI = { extension: Lucid.WalletApi };

/**
 * Returns an instance of the browser wallet API for the specified wallet.
 * @param walletName - The name of the wallet to get an instance of.
 * @returns An instance of the BrowserWalletAPI class.
 */
export async function mkBrowserWallet(walletName: SupportedWalletName): Promise<WalletAPI> {
  if (
    getInstalledWalletExtensions()
      .map((extension) => extension.name.toLowerCase())
      .includes(walletName.toLowerCase())
  ) {
    const extension = await window.cardano[walletName.toLowerCase()].enable();
    const di = { extension };
    return {
      waitConfirmation: waitConfirmation(di),
      signTx: signTx(di),
      getChangeAddress: getChangeAddress(di),
      getUsedAddresses: getUsedAddresses(di),
      getCollaterals: getCollaterals(di),
      getUTxOs: getUTxOs(di),
      isMainnet: isMainnet(di),
      getTokens: getTokens(di),
      getLovelaces: getLovelaces(di),
    };
  } else {
    throw new Error(`Wallet ${walletName} is not available in the browser`);
  }
}

// DISCUSSION: This can currently wait forever. Maybe we should add
//             an abort controller or a timeout
/**
 * @hidden
 */
export const waitConfirmation =
  (di: ExtensionDI) =>
  (txHash: string, checkInterval = 3000) => {
    return new Promise<boolean>((txConfirm) => {
      const pollingId = setInterval(async () => {
        const utxos = await getUTxOs(di)();
        const isConfirmed = utxos.filter((utxo) => unTxOutRef(utxo).split("#", 2)[0] == txHash).length > 0;
        if (isConfirmed) {
          clearInterval(pollingId);
          return txConfirm(true);
        }
      }, checkInterval);
    });
  };

/**
 * @hidden
 */
export const signTx =
  ({ extension }: ExtensionDI) =>
  (tx: string) => {
    return extension.signTx(tx, true);
  };

/**
 * @hidden
 */
export const getChangeAddress =
  ({ extension }: ExtensionDI) =>
  async () => {
    const changeAddress = await extension.getChangeAddress();
    return deserializeAddress(changeAddress);
  };

/**
 * @hidden
 */
export const getUsedAddresses =
  ({ extension }: ExtensionDI) =>
  async () => {
    const usedAddresses = await extension.getUsedAddresses();
    return usedAddresses.map(deserializeAddress);
  };

/**
 * @hidden
 */
export const getUTxOs =
  ({ extension }: ExtensionDI) =>
  async () => {
    const utxos = (await extension.getUtxos()) ?? [];
    return utxos.map(deserializeTxOutRef);
  };

/**
 * @hidden
 */
export const getCollaterals =
  ({ extension }: ExtensionDI) =>
  async () => {
    const collaterals = (await extension.experimental.getCollateral()) ?? [];
    return collaterals.map(deserializeTxOutRef);
  };

/**
 * @hidden
 */
export const isMainnet =
  ({ extension }: ExtensionDI) =>
  async () => {
    const networkId = await extension.getNetworkId();
    return networkId == 1;
  };

/**
 * @hidden
 */
export const getTokens =
  ({ extension }: ExtensionDI) =>
  async () => {
    const balances = await extension.getBalance();
    return valueToTokens(deserializeValue(balances));
  };

/**
 * @hidden
 */
export const getLovelaces =
  ({ extension }: ExtensionDI) =>
  async () => {
    const balances = await extension.getBalance();
    return valueToLovelaces(deserializeValue(balances));
  };

function deserializeAddress(addressHex: string): AddressBech32 {
  return addressBech32(C.Address.from_bytes(hex.decode(addressHex)).to_bech32(undefined));
}

function deserializeTxOutRef(utxoStr: string): TxOutRef {
  const utxo = C.TransactionUnspentOutput.from_bytes(hex.decode(utxoStr));
  const input = JSON.parse(utxo.input().to_json());
  return txOutRef(input.transaction_id + "#" + input.index);
}

const deserializeValue = (value: string) => C.Value.from_bytes(hex.decode(value));

const valueToTokens = (value: Lucid.C.Value) => {
  const tokenValues: Token[] = [lovelaces(valueToLovelaces(value))];

  const multiAsset = value.multiasset();
  if (multiAsset !== undefined) {
    const policies = multiAsset.keys();
    for (let i = 0; i < policies.len(); i += 1) {
      const aPolicyId = policies.get(i);
      const policyAssets = multiAsset.get(aPolicyId);
      if (policyAssets !== undefined) {
        const policyAssetNames = policyAssets.keys();
        for (let j = 0; j < policyAssetNames.len(); j += 1) {
          const assetName = policyAssetNames.get(j);
          const quantity = policyAssets.get(assetName) ?? C.BigNum.from_str("0");
          tokenValues.push(
            token(BigInt(quantity.to_str()).valueOf())(
              assetId(policyId(aPolicyId.to_hex()))(
                utf8.decode(assetName.to_bytes()).substring(1) // N.H : investigate why 1 aditional character is returned
              )
            )
          );
        }
      }
    }
  }

  return tokenValues;
};

const valueToLovelaces = (value: Lucid.C.Value) => BigInt(value.coin().to_str()).valueOf();
