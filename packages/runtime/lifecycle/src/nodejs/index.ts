import { mkFPTSRestClient, mkRestClient } from "@marlowe.io/runtime-rest-client";
import * as Wallet from "@marlowe.io/wallet/lucid";
import * as Generic from "../generic/runtime.js";
import { RuntimeLifecycle } from "../api.js";
import { Lucid } from "lucid-cardano";
import * as t from "io-ts/lib/index.js";
import { dynamicAssertType } from "@marlowe.io/adapter/io-ts";

export async function mkRuntimeLifecycle(runtimeURL: string, lucid: Lucid, strict = true): Promise<RuntimeLifecycle> {
  dynamicAssertType(t.boolean, strict, "Invalid type for argument 'strict', expected boolean");
  const wallet = await Wallet.mkLucidWallet(lucid);
  const deprecatedRestAPI = mkFPTSRestClient(runtimeURL);
  const restClient = mkRestClient(runtimeURL, strict);
  return Generic.mkRuntimeLifecycle(deprecatedRestAPI, restClient, wallet);
}
