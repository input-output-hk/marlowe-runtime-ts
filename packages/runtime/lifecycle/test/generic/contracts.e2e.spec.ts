import { pipe } from "fp-ts/lib/function.js";
import { addDays } from "date-fns";
import { AxiosError } from "axios";
import { datetoTimeout, inputNotify, close } from "@marlowe.io/language-core-v1";
import { oneNotifyTrue } from "@marlowe.io/language-examples";

import console from "console";
import { MINUTES } from "@marlowe.io/adapter/time";
import { logError, logInfo, mkTestEnvironment, readTestConfiguration } from "@marlowe.io/testing-kit";

global.console = console;

describe("Runtime Contract Lifecycle ", () => {
  it(
    "can create a Marlowe Contract ",
    async () => {
      try {
        const { bank, mkLifecycle } = await readTestConfiguration().then(mkTestEnvironment({}));
        const runtimeLifecycle = mkLifecycle(bank);
        const contract = await runtimeLifecycle.newContractAPI.create({ contract: close });
        await contract.waitForConfirmation();
        logInfo(`contract created : ${contract.id}`);
        expect(await contract.isClosed()).toBeTruthy();
      } catch (e) {
        const error = e as AxiosError;
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
          logInfo(`contract created : ${contractInstance.id}`);
          expect(await contractInstance.isActive()).toBeTruthy();

          await bank.waitRuntimeSyncingTillCurrentWalletTip(runtime.restClient);
          await contractInstance.applyInputs({ inputs: [inputNotify] });
          await contractInstance.waitForConfirmation();

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
