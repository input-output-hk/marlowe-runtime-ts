// import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";
import { mkRestClient } from "@marlowe.io/runtime-rest-client";

import { Blockfrost } from "lucid-cardano";

// import { RuntimeLifecycle } from "@marlowe.io/runtime-lifecycle/api";
import { Assets } from "@marlowe.io/runtime-core";
import {
  TestConfiguration,
  logDebug,
  logInfo,
  logWalletInfo,
  mkLucidBankWallet,
} from "@marlowe.io/testing-kit";
import { ProvisionRequest, BankWalletAPI, DAppWalletAPI } from "../wallet/api.js";

/**
 * List of Participants available for a test
 */
export type TestEnvironment = {
  /**
   * Bank Wallet
   */
  bank: BankWalletAPI;
  /**
   * List of Participants available for the test
   */
  participants: Participants;
  /**
   * Access to runtime client and the runtime lifecycle api
   */
  // mkLifecycle: (wallet: DAppWalletAPI) => RuntimeLifecycle;
};

export type ParticipantInfo = {
  /**
   * Wallet Test instance
   */
  wallet: DAppWalletAPI;
  /**
   * List of Assets provisionned By the Bank Wallet
   */
  assetsProvisioned: Assets;
};

/**
 * List of Participants available for a test
 */
export type Participants = {
  [participant: string]: ParticipantInfo;
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

    const provider = new Blockfrost(testConfiguration.lucid.blockfrostUrl, testConfiguration.lucid.blockfrostProjectId);

    const runtimeClient = mkRestClient(testConfiguration.runtimeURL);
    const bank = await mkLucidBankWallet(runtimeClient, provider, testConfiguration.network, testConfiguration.bank.seedPhrase);

    await logWalletInfo("bank", bank);
    const bankBalance = await bank.getLovelaces();
    console.log("WT")
    if (bankBalance <= 100_000_000n) {
      throw { message: "Bank is not sufficiently provisioned (< 100 Ada)" };
    }
    logDebug("Bank is provisioned enough to run tests");
    const participants = await bank.provision(provisionRequest);
    logDebug("Participants provisioned");

    logInfo("Test Environment : Ready");
    return {
      bank,
      participants: participants,
      // mkLifecycle: (wallet: DAppWalletAPI) =>
      //   mkRuntimeLifecycle({
      //     runtimeURL: testConfiguration.runtimeURL,
      //     wallet,
      //   }),
    };
  };
