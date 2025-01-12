import { MINUTES } from "@marlowe.io/adapter/time";
import { Contract, IDeposit, lovelace } from "@marlowe.io/language-core-v1";
import { AddressBech32, ContractId, transactionWitnessSetTextEnvelope, TxOutRef } from "@marlowe.io/runtime-core";
import { mkRestClient, RestClient } from "@marlowe.io/runtime-rest-client";
import { BuildCreateContractTxRequestWithContract, BuildCreateContractTxResponse, ContractDetails, TransactionTextEnvelope } from "@marlowe.io/runtime-rest-client/contract/index.js";
import { generateSeedPhrase, logDebug, mkTestEnvironment, readTestConfiguration, safeStringify, ParticipantInfo, TestEnvironment } from "@marlowe.io/testing-kit";
import { expect, test } from "vitest";
import { isRight, match } from "fp-ts/lib/Either.js";

import console from "console";
import { fail } from "assert";
global.console = console;


type Ref<T> = { current: T | null };

const safeStringifyNoLucid = (obj: any) => safeStringify(obj, 2, ["lucid"]);

interface ContractTestContext {
  contractInfo: {
    contract: Contract,
    user: ParticipantInfo,
    contractId: Ref<ContractId>
  },
  restClient: RestClient
};

// Not sure but feel a bit better when not declaring
// shared contractId as a global variable.
const contractTest = await (async () => {
  const contractId:Ref<ContractId> = { current: null };
  const config = await readTestConfiguration();
  let testEnv:TestEnvironment|null = null;

  return test.extend<ContractTestContext>({
    restClient: async ({}, use) => {
      const config = await readTestConfiguration();
      await use(mkRestClient(config.runtimeURL));
    },
    contractInfo: async ({}, use) => {
      if(testEnv === null) {
        testEnv = await mkTestEnvironment({
          user: {
            walletSeedPhrase: generateSeedPhrase("24-words"),
            scheme: {
              lovelacesToTransfer: 10_000_000n,
              assetsToMint: { tokenA: 15n },
            },
          },
        })(config);
      };
      if(testEnv === null) throw("Test Environment not initialized - impossible!");
      const { participants: { user }} = testEnv;
      const userAddress:AddressBech32 = await user.wallet.getChangeAddress();
      const contract:Contract = {
        "when": [
          {
            "case": {
              "party": { "address": userAddress },
              "of_token": lovelace,
              "into_account": { "address": userAddress },
              "deposits": 1000n
            },
            "then": "close"
          }
        ],
        "timeout_continuation": "close",
        "timeout": 9736078190401n
      };
      logDebug("Contract: " + safeStringifyNoLucid(contract));
      use({ contract, contractId, user });
    },
  });
})();

contractTest("can navigate through some Marlowe Contracts pages" + "(GET:  /contracts/)", async ({ restClient }: ContractTestContext) => {
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
  10*MINUTES
);

contractTest(
  "can retrieve some contract Details" + "(GET:  /contracts/{contractId})",
  async ({ restClient }) => {
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
  10*MINUTES
);

contractTest("can create a contract" + "(POST/PUT:  /contracts/)",
  async ({ contractInfo, restClient }) => {
    const { contract, user } = contractInfo;
    logDebug("fetching user address");
    const userAddress:AddressBech32 = await user.wallet.getChangeAddress();
    const request: BuildCreateContractTxRequestWithContract = {
      accounts: {},
      contract: contract,
      changeAddress: userAddress,
      version: "v1",
    };

    logDebug(`request: ${safeStringifyNoLucid(request)}`);
    const createResponse = await (async () => {
      const apiRes = await restClient.buildCreateContractTx(request);
      return match(
        (err) => fail(`Error: ${safeStringifyNoLucid(err)}`) as unknown as BuildCreateContractTxResponse,
        (res: BuildCreateContractTxResponse) => res
      )(apiRes);
    })();

    expect(createResponse).toBeDefined();
    expect(createResponse.contractId).toBeDefined();
    const contractId = createResponse.contractId;

    logDebug(`createResponse: ${safeStringifyNoLucid(createResponse)}`);
    const witnessSetHex = await user.wallet.signTx(createResponse.tx.cborHex);
    logDebug(`witnessSetHex: ${witnessSetHex}`);
    const submitResponse = await restClient.submitContract({
      contractId,
      txEnvelope: transactionWitnessSetTextEnvelope(witnessSetHex),
    });
    logDebug(`submitResponse: ${safeStringifyNoLucid(submitResponse)}`);
    expect(submitResponse).toBeDefined();
    expect(isRight(submitResponse)).toBeTruthy();
    contractInfo.contractId.current = contractId;
  },
  10 * MINUTES
);

const awaitResult = async <a>(f: () => Promise<a | undefined | null>): Promise<a> => {
  let result = await f();
  while (true) {
    if (result !== undefined && result !== null) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await f();
  }
};

contractTest("can apply input to a contract", async ({ contractInfo, restClient, skip }) => {
    const { contractId: { current: contractId }, user } = contractInfo;
    if (contractId === null) {
      skip();
      return;
    }
    await awaitResult(async () => restClient.getContractById({ contractId }).then((response) => {
      return match(
        (_) => undefined,
        (res: ContractDetails) => res.utxo
      )(response);
    }));

    const userAddress:AddressBech32 = await user.wallet.getChangeAddress();
    const userParty = { address: userAddress };
    const userAccount = userParty;
    const deposit:IDeposit = {
      input_from_party: userParty,
      that_deposits: 1000n,
      of_token: lovelace,
      into_account: userAccount
    };
    const req = {
      contractId: contractId,
      changeAddress: userAddress,
      inputs: [deposit]
    };
    const applyInputsResponse = await restClient.applyInputsToContract(req);
    const txEnvelope:TransactionTextEnvelope = match(
      (error) => fail(`Error: ${safeStringifyNoLucid(error)}`) as unknown as TransactionTextEnvelope,
      (res: TransactionTextEnvelope) => res
    )(applyInputsResponse);

    const witnessSetHex = await user.wallet.signTx(txEnvelope.tx.cborHex);
    logDebug(`witnessSetHex: ${witnessSetHex}`);

    const submitResponse = await restClient.submitContractTransaction({
      contractId,
      transactionId: txEnvelope.transactionId,
      hexTransactionWitnessSet: witnessSetHex,
    });
    logDebug(`submitResponse: ${safeStringifyNoLucid(submitResponse)}`);
    expect(submitResponse).toBeDefined();
    expect(isRight(submitResponse)).toBeTruthy();
  },
  10 * MINUTES
);

