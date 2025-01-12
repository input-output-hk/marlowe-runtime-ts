/**
 * This module provides {@link @marlowe.io/wallet!api.WalletAPI} extended capabilities for
 * testing purposes. It is used for E2E testing in 2 paricular `@marlowe.io` packages :
 *   - {@link @marlowe.io/runtime-rest-client!}
 *   - {@link @marlowe.io/runtime-lifecycle!}
 * @packageDocumentation
 */

import { Network, Provider } from "lucid-cardano";
import { mkLucidBasedWallet } from "@marlowe.io/wallet";
import { RestClient } from "@marlowe.io/runtime-rest-client";

export * as Provision from "./provisionning.js";
import * as Provision from "./provisionning.js";
import { BankWalletAPI } from "../api.js";

/**
 * Creates an instance of WalletTestAPI using a Lucid wallet.
 * @param options
 */
export async function mkLucidBankWallet(runtimeClient: RestClient, provider: Provider, network: Network, seed: string): Promise<BankWalletAPI> {
  const lucidWallet = await mkLucidBasedWallet(provider, network, seed);
  return {
    ...lucidWallet,
    provision: Provision.provision(runtimeClient, lucidWallet),
  };
}

