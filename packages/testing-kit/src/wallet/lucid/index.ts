/**
 * This module provides {@link @marlowe.io/wallet!api.WalletAPI} extended capabilities for
 * testing purposes. It is used for E2E testing in 2 paricular `@marlowe.io` packages :
 *   - {@link @marlowe.io/runtime-rest-client!}
 *   - {@link @marlowe.io/runtime-lifecycle!}
 * @packageDocumentation
 */

import { Lucid } from "lucid-cardano";

import { WalletAPI, mkLucidWallet } from "@marlowe.io/wallet";

import { RestClient } from "@marlowe.io/runtime-rest-client";
import { logInfo, logWarning } from "../../logging.js";

export * as Provision from "./provisionning.js";
import * as Provision from "./provisionning.js";
import { sleep, waitForPredicatePromise } from "@marlowe.io/adapter/time";
import { WalletTestAPI } from "../api.js";

/**
 * @description Dependency Injection for the WalletTestAPI implemented with Lucid
 * @hidden
 */
export type WalletTestDI = { lucid: Lucid; wallet: WalletAPI };

/**
 * Creates an instance of WalletTestAPI using a Lucid wallet.
 * @param options
 */
export function mkLucidWalletTest(lucidWallet: Lucid): WalletTestAPI {
  const di = { lucid: lucidWallet, wallet: mkLucidWallet(lucidWallet) };
  return {
    ...di.wallet,
    ...{ provision: Provision.provision(di) },
    ...{
      waitRuntimeSyncingTillCurrentWalletTip: waitRuntimeSyncingTillCurrentWalletTip(di),
    },
  };
}

/**
 * `waitRuntimeSyncingTillCurrentWalletTip` implementation using a Lucid Wallet
 * @remarks
 * This implementation is approximative because we are waiting for the runtime chain to sync and
 * not the runtime itself. The Runtime doesn't provide a tip representing the last slot read but
 * it provides the last slot where a contract Tx activity has been read.
 * We are adding a sleep at the end, to artificially wait the runtime to sync on a synced Runtime Chain.
 * @param client
 * @param aSlotNo
 * @returns
 * @hidden
 */
const waitRuntimeSyncingTillCurrentWalletTip =
  (di: WalletTestDI) =>
  async (client: RestClient): Promise<void> => {
    const { lucid } = di;
    const currentLucidSlot = BigInt(lucid.currentSlot());
    logInfo(`Setting up a synchronization point with Runtime at SlotNo ${currentLucidSlot}`);
    await waitForPredicatePromise(isRuntimeChainMoreAdvancedThan(client, currentLucidSlot));
    process.stdout.write("\n");
    return sleep(15);
  };

/**
 * Predicate that verify is the Runtime Chain Tip >= to a givent slot
 * @param client
 * @param aSlotNo
 * @returns
 */
export const isRuntimeChainMoreAdvancedThan = (client: RestClient, aSlotNo: bigint) => () =>
  client.healthcheck().then((status) => {
    if (status.tips.runtimeChain.blockHeader.slotNo >= aSlotNo) {
      return true;
    } else {
      const delta = aSlotNo - status.tips.runtimeChain.blockHeader.slotNo;
      process.stdout.write(`Waiting Runtime to reach that point (${delta} slots behind (~${delta}s)) `);
      return false;
    }
  });
