import { mkRestClient } from "@marlowe.io/runtime-rest-client";
import { readTestConfiguration } from "@marlowe.io/testing-kit";

import console from "console";

global.console = console;

describe("contracts endpoints", () => {
  it(
    "can navigate throught some Marlowe Contracts pages" + "(GET:  /contracts/)",
    async () => {
      const config = await readTestConfiguration();
      const restClient = mkRestClient(config.runtimeURL);
      const firstPage = await restClient.getContracts({
        tags: [],
        partyAddresses: [],
        partyRoles: [],
      });
      expect(firstPage.contracts.length).toBe(100);
      expect(firstPage.page.total).toBeGreaterThan(100);

      expect(firstPage.page.next).toBeDefined();

      const secondPage = await restClient.getContracts({
        range: firstPage.page.next,
      });
      expect(secondPage.contracts.length).toBe(100);
      expect(secondPage.page.total).toBeGreaterThan(100);

      expect(secondPage.page.next).toBeDefined();

      const thirdPage = await restClient.getContracts({
        range: secondPage.page.next,
      });

      expect(thirdPage.contracts.length).toBe(100);
      expect(thirdPage.page.total).toBeGreaterThan(100);

      expect(thirdPage.page.next).toBeDefined();
    },
    100_000
  );
  it(
    "can retrieve some contract Details" + "(GET:  /contracts/{contractId})",
    async () => {
      const config = await readTestConfiguration();
      const restClient = mkRestClient(config.runtimeURL);

      const firstPage = await restClient.getContracts({
        tags: [],
        partyAddresses: [],
        partyRoles: [],
      });
      expect(firstPage.contracts.length).toBe(100);
      expect(firstPage.page.total).toBeGreaterThan(100);
      expect(firstPage.page.next).toBeDefined();

      await Promise.all(
        firstPage.contracts.map((contract) => restClient.getContractById({ contractId: contract.contractId }))
      );
    },
    100_000
  );
});
