/**
 *
  ```
  import { mkBrowserWallet, getInstalledWalletExtensions } from "@marlowe.io/wallet";
  import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";

  const runtimeURL = "<url of the Marlowe runtime>";
  const installedWalletExtensions = getInstalledWalletExtensions();

  const wallet = await mkBrowserWallet(installedWalletExtensions[0].name);
  const runtime = mkRuntimeLifecycle({
    runtimeURL,
    wallet,
  });
  ```
 * @packageDocumentation
 */

import { WalletAPI } from "@marlowe.io/wallet";
import * as Generic from "./generic/runtime.js";
import { mkFPTSRestClient, mkRestClient } from "@marlowe.io/runtime-rest-client";
import { RuntimeLifecycle } from "./api.js";
import { dynamicAssertType } from "@marlowe.io/adapter/io-ts";
import * as t from "io-ts/lib/index.js";
export * as Browser from "./browser/index.js";

/**
 * Options for creating a RuntimeLifecycle instance.
 * @category RuntimeLifecycle
 */
export interface RuntimeLifecycleOptions {
  /**
   * The URL of an available Marlowe runtime.
   */
  runtimeURL: string;
  /**
   * The wallet instance to connect to.
   */
  wallet: WalletAPI;
}

/**
 * @hidden
 */
export const RuntimeLifecycleOptionsGuard: t.Type<RuntimeLifecycleOptions> = t.type({
  runtimeURL: t.string,
  // TODO: Create a shallow guard for the wallet that checks that all methods are present as t.function.
  wallet: t.any,
});

/**
 * Creates an instance of RuntimeLifecycle.
 * @param options
 * @param strict Whether to perform runtime checking to provide helpful error messages. May have a slight negative performance impact. Default value is `true`.
 * @category RuntimeLifecycle
 */
export function mkRuntimeLifecycle(options: RuntimeLifecycleOptions, strict = true): RuntimeLifecycle {
  dynamicAssertType(RuntimeLifecycleOptionsGuard, options);
  dynamicAssertType(t.boolean, strict, "Invalid type for argument 'strict', expected boolean");
  const { runtimeURL, wallet } = options;
  const deprecatedRestAPI = mkFPTSRestClient(runtimeURL);
  const restClient = mkRestClient(runtimeURL, strict);
  return Generic.mkRuntimeLifecycle(deprecatedRestAPI, restClient, wallet);
}
