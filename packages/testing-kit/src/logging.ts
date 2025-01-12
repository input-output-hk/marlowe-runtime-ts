import { MarloweJSON } from "@marlowe.io/adapter/codec";
import JSONbigint from "json-bigint";
import { WalletAPI } from "@marlowe.io/wallet";

export const safeStringify = (obj: any, space: number = 2, skipKeys: string[] = []): string => {
  const seen = new WeakSet();
  const JSON_ = JSONbigint({
    alwaysParseAsBig: true,
    useNativeBigInt: true,
  });
  const replacer = (key: any, value: any) => {
    if(skipKeys.includes(key)) {
      return "[Skipped]";
    }

    if( typeof value?.toJSON === 'function') {
      value =  value.toJSON();
    }
    // We should continue only if we have an object different than `null`
    if(!(value !== null && typeof value === 'object')) {
      return value;
    }

    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    let newValue: any;
    if(Array.isArray(value)) {
        newValue = [];
        for(const [k, v] of Object.entries(value)) {
          newValue[k] = replacer(k, v);
        }
    } else {
      newValue = {};
      for(const [k, v] of Object.entries(value)) {
        newValue[k] = replacer(k, v);
      }
    };
    seen.delete(value);
    return newValue;
  };

  return JSON_.stringify(obj, replacer, space);
}

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
export const logWalletInfo = async (walletName: string, wallet: WalletAPI) => {
  const address = await wallet.getChangeAddress();
  const lovelaces = await wallet.getLovelaces();
  const tokens = await wallet.getTokens();
  logInfo(`Wallet ${walletName}`);
  logInfo(` - Address : ${address}`);
  logInfo(` - Lovelaces : ${lovelaces}`);
  logInfo(` - Tokens : ${MarloweJSON.stringify(tokens)}`);
};
