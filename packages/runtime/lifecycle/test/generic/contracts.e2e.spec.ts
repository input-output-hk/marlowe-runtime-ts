import { pipe } from "fp-ts/lib/function.js";
import { addDays } from "date-fns";
import { AxiosError } from "axios";
import { datetoTimeout, inputNotify, close } from "@marlowe.io/language-core-v1";
import { oneNotifyTrue } from "@marlowe.io/language-examples";

import console from "console";
import { MINUTES } from "@marlowe.io/adapter/time";
import { logError, logInfo, mkTestEnvironment, readTestConfiguration } from "@marlowe.io/testing-kit";
import {
  CanAdvance,
  CanNotify,
  ContractInstanceAPI,
  CreateContractRequest,
} from "@marlowe.io/runtime-lifecycle/api.js";

global.console = console;

describe("Runtime Contract Lifecycle ", () => {
  it(
    "can create a Marlowe Contract ",
    async () => {
      try {
        const { bank, mkLifecycle } = await readTestConfiguration().then(mkTestEnvironment({}));
        const runtime = mkLifecycle(bank);
        const contractInstance = await runtime.newContractAPI.create({ contract: close });
        await contractInstance.waitForConfirmation();
        await bank.waitRuntimeSyncingTillCurrentWalletTip(runtime.restClient);

        logInfo(`contract created : ${contractInstance.id}`);
        // N.B : This particular Close contract needs to be reduced/advanced to be closed
        expect(await contractInstance.isActive()).toBeTruthy();
        let applicableActions = await contractInstance.evaluateApplicableActions();

        expect(applicableActions.myActions.map((a) => a.type)).toStrictEqual(["Advance"]);
        const inputAdvance = await applicableActions.toInput(applicableActions.myActions[0] as CanAdvance);

        await contractInstance.applyInput({ input: inputAdvance });
        await contractInstance.waitForConfirmation();
        await bank.waitRuntimeSyncingTillCurrentWalletTip(runtime.restClient);
        expect(await contractInstance.isClosed()).toBeTruthy();
      } catch (e) {
        const error = e as AxiosError;
        logError("An error occurred while creating a contract");
        logError(JSON.stringify(error.response?.data));
        logError(JSON.stringify(error));
        expect(true).toBe(false);
      }
    },
    10 * MINUTES
  ),
    it(
      "can Apply Inputs to a Contract",
      async () => {
        try {
          const { bank, mkLifecycle } = await readTestConfiguration().then(mkTestEnvironment({}));

          const runtime = mkLifecycle(bank);

          const notifyTimeout = pipe(addDays(Date.now(), 1), datetoTimeout);
          const contractInstance = await runtime.newContractAPI.create({ contract: oneNotifyTrue(notifyTimeout) });
          await contractInstance.waitForConfirmation();
          await bank.waitRuntimeSyncingTillCurrentWalletTip(runtime.restClient);
          logInfo(`contract created : ${contractInstance.id}`);
          expect(await contractInstance.isActive()).toBeTruthy();

          let applicableActions = await contractInstance.evaluateApplicableActions();

          expect(applicableActions.myActions.map((a) => a.type)).toStrictEqual(["Notify"]);
          const inputNotify = await applicableActions.toInput(applicableActions.myActions[0] as CanNotify);

          await contractInstance.applyInput({ input: inputNotify });
          await contractInstance.waitForConfirmation();
          await bank.waitRuntimeSyncingTillCurrentWalletTip(runtime.restClient);

          expect(await contractInstance.isClosed()).toBeTruthy();
        } catch (e) {
          const error = e as AxiosError;
          logError(error.message);
          logError(JSON.stringify(error.response?.data));
          logError(JSON.stringify(error));
          expect(true).toBe(false);
        }
      },
      10 * MINUTES
    );
});
