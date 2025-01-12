/**
 * This module provides {@link @marlowe.io/wallet!api.WalletAPI} extended capabilities for
 * testing purposes. It is used for E2E testing in 2 paricular `@marlowe.io` packages :
 *   - {@link @marlowe.io/runtime-rest-client}
 *   - {@link @marlowe.io/runtime-lifecycle}
 * @packageDocumentation
 */
import { WalletAPI } from "@marlowe.io/wallet";
import { RestClient } from "@marlowe.io/runtime-rest-client";
import { SeedPhrase } from "./seedPhrase.js";
import * as RuntimeCore from "@marlowe.io/runtime-core";

/** TODO: paluh
 * The BankWalletAPI is an extended {@link @marlowe.io/wallet!api.WalletAPI} for interacting with a Cardano wallet in a
 * Test Environment.
 */
export interface BankWalletAPI extends WalletAPI {
  /**
   * Execute a Provisioning Scheme from this current WalletTestAPI instance for the simulated participants of a Test:
   *  - Minting Tokens with a basic policy id to Participants
   *  - Transfering Lovelaces to Participants
   * @param request
   */
  provision(request: ProvisionRequest): Promise<ProvisionResponse>;
}

/* TODO: paluh */
export interface DAppWalletAPI extends WalletAPI {
  restClient: RestClient;
}

//  /** TODO: paluh
//   * Wait if the runtime is behind the current slot of the wallet Test.
//   * @remarks
//   * Wallets and Marlowe Runtimes are potentially connected to 2 differents Cardano Nodes.
//   * In our test environment, in order to avoid inconsistencies when building Tx, we need
//   * to provide some synchronization mechanism. Depending on which component is performing the last
//   * Tx, we need to wait for the other one to catch up to have a consustent behaviour.
//   * @param client
//   */
//  waitRuntimeSyncingTillCurrentWalletTip(client: RestClient): Promise<void>;
//  // TODO : waitWalletSyncingTillCurrentRuntimeTip
//


/**
 * Provision Request on a given BankWalletAPI instance
 */
export type ProvisionRequest = {
  [participant: string]: {
    /**
     * SeedPhrase of the participant wallet.
     */
    walletSeedPhrase: SeedPhrase;
    /**
     * Provisionning Scheme
     */
    scheme: ProvisionScheme;
  };
};

/** TODO: paluh
 * Provision Response on a given WalletTestAPI instance (see Request)
 */
export type ProvisionResponse = {
  [participant: string]: {
    wallet: DAppWalletAPI,
    assetsProvisioned: RuntimeCore.Assets;
  };
};

/** TODO: paluh
 * Provisionnibg Scheme on a given WalletTestAPI instance
 */
export type ProvisionScheme = {
  lovelacesToTransfer: RuntimeCore.AssetQuantity;
  assetsToMint: MintingScheme;
};

/** TODO: paluh
 * Minting Scheme on a given WalletTestAPI instance
 */
export type MintingScheme = {
  [assetName: RuntimeCore.AssetName]: RuntimeCore.AssetQuantity;
};
