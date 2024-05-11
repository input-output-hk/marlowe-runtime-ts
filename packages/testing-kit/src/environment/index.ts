import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";
import { mkRestClient } from "@marlowe.io/runtime-rest-client";

import { Lucid, Blockfrost } from "lucid-cardano";

import { RuntimeLifecycle } from "@marlowe.io/runtime-lifecycle/api";
import { Assets } from "@marlowe.io/runtime-core";
import {
  TestConfiguration,
  logDebug,
  logInfo,
  logWalletInfo,
  logWarning,
  mkLucidWalletTest,
} from "@marlowe.io/testing-kit";
import { ProvisionRequest, WalletTestAPI } from "../wallet/api.js";

/**
 * List of Participants available for a test
 */
export type TestEnvironment = {
  /**
   * Bank Wallet
   */
  bank: WalletTestAPI;
  /**
   * List of Participants available for the test
   */
  participants: Participants;
  /**
   * Access to runtime client and the runtime lifecycle api
   */
  mkLifecycle: (wallet: WalletTestAPI) => RuntimeLifecycle;
};

/**
 * List of Participants available for a test
 */
export type Participants = {
  [participant: string]: {
    /**
     * Wallet Test instance
     */
    wallet: WalletTestAPI;
    /**
     * List of Assets provisionned By the Bank Wallet
     */
    assetsProvisioned: Assets;
  };
};

/**
 * Provide a Test Environment to execute E2E tests over a Lucid Wallet and an instance of a
 * Marlowe Runtime.
 * @param provisionRequest
 * @returns
 */
export const mkTestEnvironment =
  (provisionRequest: ProvisionRequest) =>
  async (testConfiguration: TestConfiguration): Promise<TestEnvironment> => {
    logInfo("Test Environment : Initiating");

    const bankLucid = await Lucid.new(
      new Blockfrost(testConfiguration.lucid.blockfrostUrl, testConfiguration.lucid.blockfrostProjectId),
      testConfiguration.network
    );

    bankLucid.selectWalletFromSeed(testConfiguration.bank.seedPhrase);

    const bank = mkLucidWalletTest(bankLucid);

    await logWalletInfo("bank", bank);

    const bankBalance = await bank.getLovelaces();
    if (bankBalance <= 100_000_000n) {
      throw { message: "Bank is not sufficiently provisionned (< 100 Ada)" };
    }
    logDebug("Bank is provisionned enough to run tests");
    const participants = await bank.provision(provisionRequest);
    logDebug("Participants provisionned");
    await bank.waitRuntimeSyncingTillCurrentWalletTip(mkRestClient(testConfiguration.runtimeURL));

    logInfo("Test Environment : Ready");
    return {
      bank,
      participants: participants,
      mkLifecycle: (wallet: WalletTestAPI) =>
        mkRuntimeLifecycle({
          runtimeURL: testConfiguration.runtimeURL,
          wallet,
        }),
    };
  };
