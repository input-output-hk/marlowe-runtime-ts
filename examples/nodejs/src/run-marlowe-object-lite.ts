import { mkLucidWallet, WalletAPI } from "@marlowe.io/wallet";
import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";
import { Lucid, Blockfrost, C } from "lucid-cardano";
import { readConfig } from "./config.js";
import { datetoTimeout, Token, When } from "@marlowe.io/language-core-v1";
import { contractId, ContractId, TxId } from "@marlowe.io/runtime-core";
import { Address } from "@marlowe.io/language-core-v1";
import { ContractBundleMap, lovelace, close } from "@marlowe.io/marlowe-object";
import { input, select } from "@inquirer/prompts";
import { RuntimeLifecycle } from "@marlowe.io/runtime-lifecycle/api";
import {
  AppliedActionResult,
  getApplicableActions,
  mkApplicableActionsFilter,
} from "./experimental-features/applicable-inputs.js";
import arg from "arg";
import * as t from "io-ts/lib/index.js";
import { mkSourceMap, SourceMap } from "./experimental-features/source-map.js";
import { POSIXTime, posixTimeToIso8601 } from "@marlowe.io/adapter/time";
import { SingleInputTx } from "@marlowe.io/language-core-v1/semantics";
import * as ObjG from "@marlowe.io/marlowe-object/guards";
import * as fs from "fs/promises";
import { MarloweJSON } from "@marlowe.io/adapter/codec";
// When this script is called, start with main.
main();

// #region Command line arguments
function parseCli() {
  const args = arg({
    "--help": Boolean,
    "--config": String,
    "-c": "--config",
    "--source": String,
  });

  if (args["--help"]) {
    printHelp(0);
  }
  function printHelp(exitStatus: number): never {
    console.log(
      "Usage: npm run run-marlowe-object-lite -- --config <config-file> --source <source-file>"
    );
    console.log("");
    console.log("Example:");
    console.log(
      "  npm run run-marlowe-object-lite -- --config alice.config --source object.json"
    );
    console.log("Options:");
    console.log("  --help: Print this message");
    console.log(
      "  --config | -c: The path to the config file [default .config.json]"
    );
    console.log("  --source: The path to the marlowe-object bundle map");
    process.exit(exitStatus);
  }
  const sourcePath = args["--source"];
  if (!sourcePath) {
    console.error("Error: --source is required");
    printHelp(1);
  }
  return {
    sourcePath,
    config: args["--config"] ?? ".config.json",
  };
}

// #endregion

// #region Interactive menu

/**
 * Small command line utility that prints a confirmation message and writes dots until the transaction is confirmed
 * NOTE: If we make more node.js cli tools, we should move this to a common place
 */
async function waitIndicator(wallet: WalletAPI, txId: TxId) {
  process.stdout.write("Waiting for the transaction to be confirmed...");
  const intervalId = setInterval(() => {
    process.stdout.write(".");
  }, 1000);
  await wallet.waitConfirmation(txId);
  clearInterval(intervalId);
  process.stdout.write("\n");
}

async function createContractMenu(
  lifecycle: RuntimeLifecycle,
  sourcePath: string
) {
  const sourceObject = await readSourceFile(sourcePath);
  const sourceMap = await mkSourceMap(lifecycle, sourceObject);
  const [contractId, txId] = await sourceMap.createContract({});

  console.log(`Contract created with id ${contractId}`);

  await waitIndicator(lifecycle.wallet, txId);

  return contractMenu(lifecycle, sourceMap, contractId);
}

/**
 * This is an Inquirer.js flow to load an existing contract
 * @param lifecycle
 * @returns
 */
async function loadContractMenu(
  lifecycle: RuntimeLifecycle,
  sourcePath: string
) {
  // First we ask the user for a contract id
  const cidStr = await input({
    message: "Enter the contractId",
  });
  const cid = contractId(cidStr);
  const validationResult = await validateExistingContract(
    lifecycle,
    cid,
    sourcePath
  );

  if (validationResult === "InvalidContract") {
    console.log(
      "Invalid contract, it does not have the expected contract source"
    );
    return;
  }

  return contractMenu(lifecycle, validationResult.sourceMap, cid);
}

function isLovelace(token: Token) {
  return token.currency_symbol === "" && token.token_name === "";
}

/**
 * This is an Inquirer.js flow to interact with a contract
 */
async function contractMenu(
  lifecycle: RuntimeLifecycle,
  sourceMap: SourceMap<unknown>,
  contractId: ContractId
): Promise<void> {
  // Get and print the contract logical state.
  // const inputHistory = await lifecycle.contracts.getInputHistory(contractId);

  // See what actions are applicable to the current contract state
  const applicableActions = await getApplicableActions(
    lifecycle.restClient,
    contractId
  );
  const myActionsFilter = await mkApplicableActionsFilter(lifecycle.wallet);
  const myActions = applicableActions.filter(myActionsFilter);

  const choices: Array<{
    name: string;
    value: { actionType: string; results?: AppliedActionResult };
  }> = [
    {
      name: "Re-check contract state",
      value: { actionType: "check-state", results: undefined },
    },
    ...myActions.map((action) => {
      switch (action.type) {
        case "Advance":
          return {
            name: "Close contract",
            value: { actionType: "advance", results: action.applyAction() },
          };

        case "Deposit":
          const tokenStr = isLovelace(action.deposit.of_token)
            ? "lovelaces"
            : `${action.deposit.of_token.currency_symbol}.${action.deposit.of_token.token_name}`;
          return {
            name: `Deposit ${action.deposit.deposits} ${tokenStr}`,
            value: { actionType: "deposit", results: action.applyAction() },
          };
        default:
          throw new Error("Unexpected action type");
      }
    }),
    {
      name: "Return to main menu",
      value: { actionType: "return", results: undefined },
    },
  ];

  const action = await select({
    message: "Contract menu",
    choices,
  });
  switch (action.actionType) {
    case "check-state":
      return contractMenu(lifecycle, sourceMap, contractId);
    case "advance":
    case "deposit":
      if (!action.results) throw new Error("This should not happen");
      console.log("Applying input");
      const txId = await lifecycle.contracts.applyInputs(contractId, {
        inputs: action.results.inputs,
        // Enabling this yields a 400 error if it is too far in the future
        // invalidBefore: posixTimeToIso8601(
        //   action.results.environment.timeInterval.from
        // ),
        // invalidHereafter: posixTimeToIso8601(
        //   action.results.environment.timeInterval.to
        // ),
      });
      console.log(`Input applied with txId ${txId}`);
      await waitIndicator(lifecycle.wallet, txId);
      return contractMenu(lifecycle, sourceMap, contractId);
    case "return":
      return;
  }
}

async function mainLoop(lifecycle: RuntimeLifecycle, sourcePath: string) {
  try {
    while (true) {
      const address = await lifecycle.wallet.getChangeAddress();
      console.log("Wallet address:", address);
      const action = await select({
        message: "Main menu",
        choices: [
          { name: "Create a contract", value: "create" },
          { name: "Load contract", value: "load" },
          { name: "Exit", value: "exit" },
        ],
      });
      switch (action) {
        case "create":
          await createContractMenu(lifecycle, sourcePath);
          break;
        case "load":
          await loadContractMenu(lifecycle, sourcePath);
          break;
        case "exit":
          process.exit(0);
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("closed the prompt")) {
      process.exit(0);
    }
    if (e instanceof Error) {
      console.error(e.message);
      process.exit(1);
    } else {
      throw e;
    }
  }
}
// #endregion

type ValidationResults =
  | "InvalidContract"
  | {
      sourceMap: SourceMap<unknown>;
    };

async function readSourceFile(sourcePath: string) {
  const sourceJson = await fs
    .readFile(sourcePath, { encoding: "utf-8" })
    .then(MarloweJSON.parse);
  const sourceObject = ObjG.ContractBundleMap.decode(sourceJson);
  if (sourceObject._tag === "Left") {
    throw new Error(`Invalid source file`);
  }
  return sourceObject.right;
}

async function validateExistingContract(
  lifecycle: RuntimeLifecycle,
  contractId: ContractId,
  sourcePath: string
): Promise<ValidationResults> {
  const sourceObject = await readSourceFile(sourcePath);

  const sourceMap = await mkSourceMap(lifecycle, sourceObject);
  const isInstanceof = await sourceMap.contractInstanceOf(contractId);
  if (!isInstanceof) {
    return "InvalidContract";
  }
  return { sourceMap };
}

async function main() {
  const args = parseCli();
  const config = await readConfig(args.config);
  const lucid = await Lucid.new(
    new Blockfrost(config.blockfrostUrl, config.blockfrostProjectId),
    config.network
  );
  lucid.selectWalletFromSeed(config.seedPhrase);
  const rewardAddressStr = await lucid.wallet.rewardAddress();

  const runtimeURL = config.runtimeURL;

  const wallet = mkLucidWallet(lucid);

  const lifecycle = mkRuntimeLifecycle({
    runtimeURL,
    wallet,
  });
  try {
    await mainLoop(lifecycle, args.sourcePath);
  } catch (e) {
    console.log(`Error : ${JSON.stringify(e, null, 4)}`);
  }
}
