import { pipe } from "fp-ts/lib/function.js";
import { addDays } from "date-fns";

import { datetoTimeout } from "@marlowe.io/language-core-v1";

import console from "console";
import { mkaccountDeposits, runtimeTokenToMarloweTokenValue } from "@marlowe.io/runtime-core";
import { MINUTES } from "@marlowe.io/adapter/time";
import { AtomicSwap } from "@marlowe.io/language-examples";
import {
  generateSeedPhrase,
  logDebug,
  logInfo,
  logWalletInfo,
  readTestConfiguration,
  mkTestEnvironment,
  logError,
} from "@marlowe.io/testing-kit";
import { AxiosError } from "axios";
import { MarloweJSON } from "@marlowe.io/adapter/codec";
import {
  CanDeposit,
  CanNotify,
  ContractInstanceAPI,
  CreateContractRequest,
  CreateContractRequestFromContract,
  RuntimeLifecycle,
  onlyByContractIds,
} from "@marlowe.io/runtime-lifecycle/api";

import { mintRole } from "@marlowe.io/runtime-rest-client/contract";
import { computeTransaction, emptyState, reduceContractUntilQuiescent } from "@marlowe.io/language-core-v1/semantics";

global.console = console;

describe("swap", () => {
  it(
    "can execute the nominal case",
    async () => {
      try {
        logInfo("Starting Test");
        const { bank, mkLifecycle, participants } = await readTestConfiguration().then((config) => {
          return mkTestEnvironment({
            seller: {
              walletSeedPhrase: generateSeedPhrase("24-words"),
              scheme: {
                lovelacesToTransfer: 25_000_000n,
                assetsToMint: { tokenA: 15n },
              },
            },
            buyer: {
              walletSeedPhrase: generateSeedPhrase("24-words"),
              scheme: {
                lovelacesToTransfer: 25_000_000n,
                assetsToMint: { tokenB: 10n },
              },
            },
          })(config);
        });

        const { seller, buyer } = participants;

        await logWalletInfo("seller", seller.wallet);
        await logWalletInfo("buyer", buyer.wallet);
        const sellerLifecycle = mkLifecycle(seller.wallet);
        const buyerLifecycle = mkLifecycle(buyer.wallet);
        const anyoneLifecycle = mkLifecycle(bank);


        // when:
        // - case:
        //     party:
        //       role_token: Ada provider
        //     deposits:
        //       multiply: 1000000
        //       times: 30
        //     of_token:
        //       currency_symbol: ''
        //       token_name: ''
        //     into_account:
        //       role_token: Ada provider
        //   then:
        //     when:
        //     - case:
        //         party:
        //           role_token: Other provider
        //         deposits:
        //           multiply: 1000000
        //           times: 25
        //         of_token:
        //           currency_symbol: ''
        //           token_name: ''
        //         into_account:
        //           role_token: Other provider
        //       then:
        //         pay:
        //           multiply: 1000000
        //           times: 30
        //         token:
        //           currency_symbol: ''
        //           token_name: ''
        //         from_account:
        //           role_token: Ada provider
        //         to:
        //           party:
        //             role_token: Other provider
        //         then:
        //           pay:
        //             multiply: 1000000
        //             times: 25
        //           token:
        //             currency_symbol: ''
        //             token_name: ''
        //           from_account:
        //             role_token: Other provider
        //           to:
        //             party:
        //               role_token: Ada provider
        //           then: close
        //     timeout: 1961123625000
        //     timeout_continuation: close
        // timeout: 1929587625000
        // timeout_continuation: close





        const scheme: AtomicSwap.Scheme = {
          offer: {
            seller: { address: await seller.wallet.getChangeAddress() },
            deadline: pipe(addDays(Date.now(), 1), datetoTimeout),
            asset: runtimeTokenToMarloweTokenValue(seller.assetsProvisioned.tokens[0]),
          },
          ask: {
            buyer: { role_token: "buyer" },
            deadline: pipe(addDays(Date.now(), 1), datetoTimeout),
            asset: runtimeTokenToMarloweTokenValue(buyer.assetsProvisioned.tokens[0]),
          },
          swapConfirmation: {
            deadline: pipe(addDays(Date.now(), 1), datetoTimeout),
          },
        };

        const swapContract = AtomicSwap.mkContract(scheme);
        logDebug(`contract: ${MarloweJSON.stringify(swapContract, null, 4)}`);

        logInfo("Contract Creation");

        const sellerContractInstance = await sellerLifecycle.newContractAPI.create({
          contract: swapContract,
          roles: { [scheme.ask.buyer.role_token]: mintRole("OpenRole") },
          accountDeposits: mkaccountDeposits([[scheme.offer.seller, seller.assetsProvisioned]]),
        });

        sellerContractInstance.waitForConfirmation();
        await seller.wallet.waitRuntimeSyncingTillCurrentWalletTip(sellerLifecycle.restClient);
        expect(await sellerContractInstance.isActive()).toBeTruthy();

        logInfo(`contract created : ${sellerContractInstance.id}`);

        logInfo(`Buyer > Swap`);

        const buyerContractInstance = await buyerLifecycle.newContractAPI.load(sellerContractInstance.id);
        let applicableActions = await buyerContractInstance.evaluateApplicableActions();
        // N.B : the applicable actions' API is not able yet to handle Open Roles in the contract properly
        // so myactions will be empty in that case and we need to use actions instead and manually select
        // the action Desposit we want to apply.
        expect(applicableActions.actions.map((a) => a.type)).toStrictEqual(["Deposit", "Choice"]);

        const swap = await applicableActions.toInput(applicableActions.actions[0] as CanDeposit);

        await buyerContractInstance.applyInput({ input: swap });

        await buyerContractInstance.waitForConfirmation();
        await buyer.wallet.waitRuntimeSyncingTillCurrentWalletTip(sellerLifecycle.restClient);

        logInfo(`Anyone > Confirm Swap`);

        const anyoneContractInstance = await anyoneLifecycle.newContractAPI.load(sellerContractInstance.id);
        applicableActions = await buyerContractInstance.evaluateApplicableActions();
        expect(applicableActions.myActions.map((a) => a.type)).toStrictEqual(["Notify"]);
        const swapConfirmation = await applicableActions.toInput(applicableActions.myActions[0] as CanNotify);

        await anyoneContractInstance.applyInput({ input: swapConfirmation });

        await anyoneContractInstance.waitForConfirmation();
        await buyer.wallet.waitRuntimeSyncingTillCurrentWalletTip(sellerLifecycle.restClient);

        expect(anyoneContractInstance.isClosed).toBeTruthy();

        logInfo(`Buyer > Retrieve Payout`);

        const buyerPayouts = await buyerLifecycle.payouts.available(onlyByContractIds([buyerContractInstance.id]));
        expect(buyerPayouts.length).toStrictEqual(1);
        await buyerLifecycle.payouts.withdraw([buyerPayouts[0].payoutId]);

        logInfo(`Swapped Completed`);
        await logWalletInfo("seller", seller.wallet);
        await logWalletInfo("buyer", buyer.wallet);
      } catch (e) {
        logError(`Error occurred while Executing the Tests : ${MarloweJSON.stringify(e, null, 4)}`);
        const error = e as AxiosError;
        logError(`Details : ${MarloweJSON.stringify(error.response?.data, null, 4)}`);
        expect(true).toBe(false);
      }
    },
    10 * MINUTES
  );
});
