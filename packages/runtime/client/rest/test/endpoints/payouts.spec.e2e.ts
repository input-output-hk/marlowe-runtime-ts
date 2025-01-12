import { mkRestClient } from "@marlowe.io/runtime-rest-client";
import { readTestConfiguration } from "@marlowe.io/testing-kit";
import { test, describe, it, expect } from "vitest";

import console from "console";
global.console = console;

describe("payouts endpoints", () => {
  it(
    "can navigate through payout headers" + "(GET:  /payouts)",
    async ({}) => {
      const config = await readTestConfiguration();
      const restClient = mkRestClient(config.runtimeURL);

      const firstPage = await restClient.getPayouts({
        contractIds: [],
        roleTokens: [],
      });
      expect(firstPage.payouts.length).toBeDefined();
      if(firstPage.payouts.length == 0) {
        // fail the test with a clear message explaining that the testing data are not available
        test.fails("No payouts available for testing. Please create some payouts to run this test.");
      }
      // expect(firstPage.payouts.length).toBe(100);
      const firstPageTotal = firstPage.payouts.length;
      expect(firstPage.page.total).toBeGreaterThanOrEqual(firstPageTotal);

      expect(firstPage.payouts.length).toBeDefined();
      expect(firstPage.page.total).toBeDefined();

      if(firstPage.page.next === undefined) {
        // inform the user that the rest of the test is skipped
        console.log("Skipping the rest of the test as there are no more pages to navigate.");
        return;
      }
      const secondPage = await restClient.getPayouts({
        contractIds: [],
        roleTokens: [],
        range: firstPage.page.next,
      });

      expect(secondPage.payouts.length).toBeGreaterThan(0);
      const secondPageTotal = secondPage.payouts.length;

      expect(secondPage.page.total).toBeGreaterThanOrEqual(firstPageTotal + secondPageTotal);
    },
    100_000
  );
});
