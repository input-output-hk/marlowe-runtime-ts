/**
 * This module provides a helper function to create a {@link api.RuntimeLifecycle} using a CIP-30
 * wallet in the browser.
 *
 * ```html
 * <html>
 *   <body>
 *     <script src="https://cdn.jsdelivr.net/gh/input-output-hk/marlowe-ts-sdk@0.4.0-beta-rc1/jsdelivr-npm-importmap.js"></script>
 *     <script type="module">
 *       import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle/browser";
 *       const walletName = "nami";
 *       const runtimeURL = "http://localhost:32788";
 *
 *       console.log(
 *         `<h2>Connecting the runtime instance at ${runtimeURL} and the ${walletName} Wallet Extension</h2>`
 *       );
 *       const runtimeLifecycle = await mkRuntimeLifecycle({
 *         walletName: walletName,
 *         runtimeURL: runtimeURL,
 *       });
 *       console.log("");
 *       console.log("Connected to runtime...");
 *       console.log("");
 *
 *       const avalaiblePayouts = await runtimeLifecycle.payouts
 *         .available()
 *         .catch((err) =>
 *           log(`Error while retrieving availaible payouts : ${err}`)
 *         );
 *       console.log(`nbPayouts retrieved : ${avalaiblePayouts.length}`);
 *       console.log("Payouts flow done 🎉");
 *     </script>
 *   </body>
 * </html>
 * ```
 * @packageDocumentation
 */

import { SupportedWalletName, SupportedWalletNameGuard, mkBrowserWallet } from "@marlowe.io/wallet/browser";
import * as Generic from "../generic/runtime.js";

import { mkFPTSRestClient, mkRestClient } from "@marlowe.io/runtime-rest-client";
import { RuntimeLifecycle } from "../api.js";
import { InvalidTypeError, strictDynamicTypeCheck } from "@marlowe.io/adapter/io-ts";
import * as t from "io-ts/lib/index.js";

/**
 * Options for creating a RuntimeLifecycle instance using the browser wallet.
 * @category RuntimeLifecycle
 */
export interface BrowserRuntimeLifecycleOptions {
  // DISCUSSION: should we pass a Map of urls instead? Ideally we could distinguish between
  //             preprod and preview, but the CIP30 standard doesn't allow that
  /**
   * The URL of an available Marlowe runtime.
   */
  runtimeURL: string;
  /**
   * The name of the wallet to connect to.
   */
  walletName: SupportedWalletName;
}

/**
 * @hidden
 */
export const BrowserRuntimeLifecycleOptionsGuard: t.Type<BrowserRuntimeLifecycleOptions> = t.type({
  runtimeURL: t.string,
  walletName: SupportedWalletNameGuard,
});

function mkRuntimeLifecycleArgumentDynamicTypeCheck(
  options: unknown,
  strict: boolean
): options is BrowserRuntimeLifecycleOptions {
  if (strict) {
    const result = BrowserRuntimeLifecycleOptionsGuard.decode(options);
    if (result._tag === "Left") {
      throw new InvalidTypeError(result.left, `Invalid argument to mkRuntimeLifecycle(${options})`);
    }
  }
  return true;
}

/**
 * Creates an instance of RuntimeLifecycle using the browser wallet.
 * @param options
 * @category RuntimeLifecycle
 */
export async function mkRuntimeLifecycle(options: BrowserRuntimeLifecycleOptions): Promise<RuntimeLifecycle>;
/**
 * Creates an instance of RuntimeLifecycle using the browser wallet.
 * @param options
 * @param strict Whether to perform runtime checking to provide helpful error messages. May have a slight negative performance impact. Default value is `true`.
 * @category RuntimeLifecycle
 */
export async function mkRuntimeLifecycle(
  options: BrowserRuntimeLifecycleOptions,
  strict = true
): Promise<RuntimeLifecycle> {
  if (!strictDynamicTypeCheck(strict)) {
    throw new InvalidTypeError([], `Invalid type for argument 'strict', expected boolean but got ${strict}`);
  }
  if (!mkRuntimeLifecycleArgumentDynamicTypeCheck(options, strict)) {
    throw new InvalidTypeError([], `Invalid type for argument 'options', expected string but got ${options}`);
  }

  const { runtimeURL, walletName } = options;
  const wallet = await mkBrowserWallet(walletName);
  const deprecatedRestAPI = mkFPTSRestClient(runtimeURL);
  const restClient = mkRestClient(runtimeURL, strict);
  return Generic.mkRuntimeLifecycle(deprecatedRestAPI, restClient, wallet);
}
