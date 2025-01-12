import { mkFPTSRestClient, mkRestClient } from "@marlowe.io/runtime-rest-client";
import * as Generic from "../generic/runtime.js";
import { RuntimeLifecycle } from "../api.js";
import * as t from "io-ts/lib/index.js";
import { dynamicAssertType } from "@marlowe.io/adapter/io-ts";
import { LucidBasedWallet } from "@marlowe.io/wallet/lucid";
import { WalletAPI } from "@marlowe.io/wallet";

export async function mkRuntimeLifecycle(runtimeURL: string, lucid: LucidBasedWallet, strict = true): Promise<RuntimeLifecycle> {
  dynamicAssertType(t.boolean, strict, "Invalid type for argument 'strict', expected boolean");
  const wallet = lucid as WalletAPI;
  const deprecatedRestAPI = mkFPTSRestClient(runtimeURL);
  const restClient = mkRestClient(runtimeURL, strict);
  return Generic.mkRuntimeLifecycle(deprecatedRestAPI, restClient, wallet);
}
