import { mkFPTSRestClient, mkRestClient } from "@marlowe.io/runtime-rest-client";
import * as Wallet from "@marlowe.io/wallet/lucid";
import * as Generic from "../generic/runtime.js";
import { RuntimeLifecycle } from "../api.js";
import { Lucid } from "lucid-cardano";
import { InvalidTypeError, strictDynamicTypeCheck } from "@marlowe.io/adapter/io-ts";

export async function mkRuntimeLifecycle(runtimeURL: string, lucid: Lucid): Promise<RuntimeLifecycle>;
export async function mkRuntimeLifecycle(runtimeURL: string, lucid: Lucid, strict: boolean): Promise<RuntimeLifecycle>;
export async function mkRuntimeLifecycle(runtimeURL: string, lucid: Lucid, strict: unknown = true) {
  if (!strictDynamicTypeCheck(strict)) {
    throw new InvalidTypeError([], `Invalid type for argument 'strict', expected boolean but got ${strict}`);
  }
  const wallet = await Wallet.mkLucidWallet(lucid);
  const deprecatedRestAPI = mkFPTSRestClient(runtimeURL);
  const restClient = mkRestClient(runtimeURL, strict);
  return Generic.mkRuntimeLifecycle(deprecatedRestAPI, restClient, wallet);
}
