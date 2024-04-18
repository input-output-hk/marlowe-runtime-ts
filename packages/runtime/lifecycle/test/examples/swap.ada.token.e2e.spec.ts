import { pipe } from "fp-ts/lib/function.js";
import { addDays } from "date-fns";

import { datetoTimeout, Input, MarloweState } from "@marlowe.io/language-core-v1";

import console from "console";
import { ContractId, payoutId, runtimeTokenToMarloweTokenValue } from "@marlowe.io/runtime-core";
import { MINUTES } from "@marlowe.io/adapter/time";
import { AtomicSwap } from "@marlowe.io/language-examples";
import { RestClient } from "@marlowe.io/runtime-rest-client";
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
import { onlyByContractIds, RuntimeLifecycle } from "@marlowe.io/runtime-lifecycle/api";

import { mintRole } from "@marlowe.io/runtime-rest-client/contract";

global.console = console;

describe("swap", () => {
  it(
    "can execute the nominal case",
    async () => {
      try {
        const { bank, mkLifecycle, participants } = await readTestConfiguration().then(
          mkTestEnvironment({
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
          })
        );

        const { seller, buyer } = participants;

        await logWalletInfo("seller", seller.wallet);
        await logWalletInfo("buyer", buyer.wallet);
        const sellerLifecycle = mkLifecycle(seller.wallet);
        const buyerLifecycle = mkLifecycle(buyer.wallet);
        const bankLifecycle = mkLifecycle(bank);

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
        const openroleCOnfig = mintRole("OpenRole");
        logInfo(`Config ${MarloweJSON.stringify(openroleCOnfig, null, 4)}`);

        const [contractId, txCreatedContract] = await sellerLifecycle.contracts.createContract({
          contract: swapContract,
          minimumLovelaceUTxODeposit: 3_000_000,
          roles: {
            [scheme.ask.buyer.role_token]: openroleCOnfig,
          },
        });
        logInfo("Contract Created");
        await seller.wallet.waitConfirmation(txCreatedContract);
        await seller.wallet.waitRuntimeSyncingTillCurrentWalletTip(sellerLifecycle.restClient);

        logInfo(`Seller > Provision Offer`);

        let actions = await getAvailableActions(sellerLifecycle, scheme, contractId);

        expect(actions.length).toBe(1);
        expect(actions[0].typeName).toBe("ProvisionOffer");
        const provisionOffer = actions[0] as AtomicSwap.ProvisionOffer;
        const offerProvisionedTx = await sellerLifecycle.contracts.applyInputs(contractId, {
          inputs: [provisionOffer.input],
        });

        await seller.wallet.waitConfirmation(offerProvisionedTx);
        await seller.wallet.waitRuntimeSyncingTillCurrentWalletTip(sellerLifecycle.restClient);

        logInfo(`Buyer > Swap`);

        actions = await getAvailableActions(sellerLifecycle, scheme, contractId);

        expect(actions.length).toBe(2);
        expect(actions[0].typeName).toBe("Swap");
        expect(actions[1].typeName).toBe("Retract");
        const swap = actions[0] as AtomicSwap.Swap;
        const swappedTx = await buyerLifecycle.contracts.applyInputs(contractId, { inputs: [swap.input] });

        await buyer.wallet.waitConfirmation(swappedTx);
        await buyer.wallet.waitRuntimeSyncingTillCurrentWalletTip(buyerLifecycle.restClient);

        logInfo(`Anyone > Confirm Swap`);

        actions = await getAvailableActions(bankLifecycle, scheme, contractId);

        expect(actions.length).toBe(1);
        expect(actions[0].typeName).toBe("ConfirmSwap");
        const confirmSwap = actions[0] as AtomicSwap.ConfirmSwap;
        const swapConfirmedTx = await bankLifecycle.contracts.applyInputs(contractId, { inputs: [confirmSwap.input] });

        await bank.waitConfirmation(swapConfirmedTx);
        await bank.waitRuntimeSyncingTillCurrentWalletTip(bankLifecycle.restClient);

        const closedState = await getClosedState(bankLifecycle, scheme, contractId);

        expect(closedState.reason.typeName).toBe("Swapped");

        logInfo(`Buyer > Retrieve Payout`);

        const buyerPayouts = await buyerLifecycle.payouts.available(onlyByContractIds([contractId]));
        expect(buyerPayouts.length).toBe(1);
        await buyerLifecycle.payouts.withdraw([buyerPayouts[0].payoutId]);

        await logWalletInfo("seller", seller.wallet);
        await logWalletInfo("buyer", buyer.wallet);
      } catch (e) {
        logError(`Error occured while Executing the Tests : ${MarloweJSON.stringify(e, null, 4)}`);
        const error = e as AxiosError;
        logError(`Details : ${MarloweJSON.stringify(error.response?.data, null, 4)}`);
        expect(true).toBe(false);
      }
    },
    10 * MINUTES
  );
});

const getClosedState = async (
  runtimeLifecycle: RuntimeLifecycle,
  scheme: AtomicSwap.Scheme,
  contractId: ContractId
): Promise<AtomicSwap.Closed> => {
  const inputHistory = await runtimeLifecycle.contracts.getInputHistory(contractId);

  await shouldBeAClosedContract(runtimeLifecycle.restClient, contractId);

  return AtomicSwap.getClosedState(scheme, inputHistory);
};

const getAvailableActions = async (
  runtimeLifecycle: RuntimeLifecycle,
  scheme: AtomicSwap.Scheme,
  contractId: ContractId
): Promise<AtomicSwap.Action[]> => {
  const inputHistory = await runtimeLifecycle.contracts.getInputHistory(contractId);

  const marloweState = await getMarloweStatefromAnActiveContract(runtimeLifecycle.restClient, contractId);
  const now = datetoTimeout(new Date());
  const contractState = AtomicSwap.getActiveState(scheme, now, inputHistory, marloweState);
  return AtomicSwap.getAvailableActions(scheme, contractState);
};

const shouldBeAClosedContract = async (restClient: RestClient, contractId: ContractId): Promise<void> => {
  const state = await restClient.getContractById({ contractId }).then((contractDetails) => contractDetails.state);
  if (state) {
    throw new Error("Contract retrieved is not Closed");
  } else {
    return;
  }
};

const shouldBeAnActiveContract = (state?: MarloweState): MarloweState => {
  if (state) return state;
  else throw new Error("Contract retrieved is not Active");
};

const getMarloweStatefromAnActiveContract = (restClient: RestClient, contractId: ContractId): Promise<MarloweState> =>
  restClient.getContractById({ contractId }).then((contractDetails) => shouldBeAnActiveContract(contractDetails.state));
