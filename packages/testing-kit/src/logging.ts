import { MarloweJSON } from "@marlowe.io/adapter/codec";
import { WalletTestAPI } from "./wallet/api.js";

export const logDebug = (message: string) =>
  process.env.LOG_DEBUG_LEVEL !== undefined && process.env.LOG_DEBUG_LEVEL === "1"
    ? console.log(`## ||| [${message}]`)
    : {};

export const logInfo = (message: string) => console.log(`## ${message}`);

export const logWarning = (message: string) => console.log(`## << ${message} >>`);

export const logError = (message: string) => console.log(`## !! [${message}] !!`);

/**
 * Logging utility for a Wallet Test API instance
 * @param walletName
 * @param wallet
 */
export const logWalletInfo = async (walletName: string, wallet: WalletTestAPI) => {
  const address = await wallet.getChangeAddress();
  const lovelaces = await wallet.getLovelaces();
  const tokens = await wallet.getTokens();
  logInfo(`Wallet ${walletName}`);
  logInfo(` - Address : ${address}`);
  logInfo(` - Lovelaces : ${lovelaces}`);
  logInfo(` - Tokens : ${MarloweJSON.stringify(tokens)}`);
};
