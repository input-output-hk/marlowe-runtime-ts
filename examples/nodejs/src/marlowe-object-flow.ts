/**
 * This is an interactive Node.js script that uses the inquirer.js to create and interact
 * with a Delayed Payment contract.
 *
 * This example features:
 * - The use of inquirer.js to create an interactive command line tool
 * - The use of the marlowe-object package to create a contract bundle
 * - How to stake the assets of a contract to a given stake address
 * - How to validate that a Merkleized contract is an instance of a given contract
 * - How to share contract sources between different runtimes
 */
import { mkLucidWallet, WalletAPI } from "@marlowe.io/wallet";
import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";
import { ContractInstanceAPI } from "@marlowe.io/runtime-lifecycle/api";
import { Lucid, Blockfrost, C } from "lucid-cardano";
import { readConfig } from "./config.js";
import { datetoTimeout, When } from "@marlowe.io/language-core-v1";
import {
  addressBech32,
  contractId,
  ContractId,
  contractIdToTxId,
  stakeAddressBech32,
  StakeAddressBech32,
  TxId,
} from "@marlowe.io/runtime-core";
import { ContractBundleMap, lovelace, close } from "@marlowe.io/marlowe-object";
import { input, select } from "@inquirer/prompts";
import { RuntimeLifecycle, ApplicableAction, CanDeposit, CanAdvance } from "@marlowe.io/runtime-lifecycle/api";
import arg from "arg";
import * as t from "io-ts/lib/index.js";
import { mkSourceMap, SourceMap } from "./experimental-features/source-map.js";
import { POSIXTime, posixTimeToIso8601 } from "@marlowe.io/adapter/time";
import { SingleInputTx } from "@marlowe.io/language-core-v1/semantics";
import * as ObjG from "@marlowe.io/marlowe-object/guards";
import { TemplateParametersOf, mkMarloweTemplate } from "@marlowe.io/marlowe-template";

// When this script is called, start with main.
main();

// #region Command line arguments
function parseCli() {
  const args = arg({
    "--help": Boolean,
    "--config": String,
    "-c": "--config",
  });

  if (args["--help"]) {
    printHelp(0);
  }
  function printHelp(exitStatus: number): never {
    console.log("Usage: npm run marlowe-object-flow -- --config <config-file>");
    console.log("");
    console.log("Example:");
    console.log("  npm run marlowe-object-flow -- --config alice.config");
    console.log("Options:");
    console.log("  --help: Print this message");
    console.log("  --config | -c: The path to the config file [default .config.json]");
    process.exit(exitStatus);
  }
  return args;
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

/**
 * This is an Inquirer.js validator for bech32 addresses
 * @returns true if the address is valid, or a string with the error message otherwise
 */
function bech32Validator(value: string) {
  try {
    C.Address.from_bech32(value);
    return true;
  } catch (e) {
    return "Invalid address";
  }
}

/**
 * This is an Inquirer.js validator for positive bigints
 * @returns true if the value is a positive bigint, or a string with the error message otherwise
 */
function positiveBigIntValidator(value: string) {
  try {
    if (BigInt(value) > 0) {
      return true;
    } else {
      return "The amount must be greater than 0";
    }
  } catch (e) {
    return "The amount must be a number";
  }
}

/**
 * This is an Inquirer.js validator for dates in the future
 * @returns true if the value is a date in the future, or a string with the error message otherwise
 */
function dateInFutureValidator(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    return "Invalid date";
  }
  if (d <= new Date()) {
    return "The date must be in the future";
  }
  return true;
}

/**
 * This is an Inquirer.js flow to create a contract
 * @param lifecycle An instance of the RuntimeLifecycle
 * @param rewardAddress An optional reward address to stake the contract rewards
 */
async function createContractMenu(lifecycle: RuntimeLifecycle, rewardAddress?: StakeAddressBech32) {
  const payee = addressBech32(
    await input({
      message: "Enter the payee address",
      validate: bech32Validator,
    })
  );
  const amountStr = await input({
    message: "Enter the payment amount in lovelaces",
    validate: positiveBigIntValidator,
  });

  const amount = BigInt(amountStr);

  const depositDeadlineStr = await input({
    message: "Enter the deposit deadline",
    validate: dateInFutureValidator,
  });
  const depositDeadline = new Date(depositDeadlineStr);

  const releaseDeadlineStr = await input({
    message: "Enter the release deadline",
    validate: dateInFutureValidator,
  });
  const releaseDeadline = new Date(releaseDeadlineStr);

  const walletAddress = await lifecycle.wallet.getChangeAddress();
  console.log(`Making a delayed payment:\n * from  ${walletAddress}\n * to ${payee}\n * for ${amount} lovelaces\n`);
  console.log(
    `The payment must be deposited before ${depositDeadline} and can be released to the payee after ${releaseDeadline}`
  );
  if (rewardAddress) {
    console.log(`In the meantime, the contract will stake rewards to ${rewardAddress}`);
  }

  const scheme = {
    payer: walletAddress,
    payee,
    amount,
    depositDeadline,
    releaseDeadline,
  };
  const metadata = delayPaymentTemplate.toMetadata(scheme);
  const sourceMap = await mkSourceMap(lifecycle, mkDelayPayment(scheme));
  const contractInstance = await sourceMap.createContract({
    stakeAddress: rewardAddress,
    tags: { DELAY_PAYMENT_VERSION: "2" },
    metadata,
  });

  console.log(`Contract created with id ${contractId}`);

  await waitIndicator(lifecycle.wallet, contractIdToTxId(contractInstance.id));

  return contractMenu(lifecycle.wallet, contractInstance, scheme, sourceMap);
}

/**
 * This is an Inquirer.js flow to load an existing contract
 * @param lifecycle
 * @returns
 */
async function loadContractMenu(lifecycle: RuntimeLifecycle) {
  // First we ask the user for a contract id
  const cidStr = await input({
    message: "Enter the contractId",
  });
  const cid = contractId(cidStr);
  // Then we make sure that contract id is an instance of our delayed payment contract
  const validationResult = await validateExistingContract(lifecycle, cid);
  if (validationResult === "InvalidMarloweTemplate") {
    console.log("Invalid contract, it does not have the expected tags");
    return;
  }
  if (validationResult === "InvalidContract") {
    console.log("Invalid contract, it does not have the expected contract source");
    return;
  }

  // If it is, we print the contract details and go to the contract menu
  console.log("Contract details:");
  console.log(`  * Pay from: ${validationResult.scheme.payer}`);
  console.log(`  * Pay to: ${validationResult.scheme.payee}`);
  console.log(`  * Amount: ${validationResult.scheme.amount} lovelaces`);
  console.log(`  * Deposit deadline: ${validationResult.scheme.depositDeadline}`);
  console.log(`  * Release deadline: ${validationResult.scheme.releaseDeadline}`);
  const contractInstance = await lifecycle.newContractAPI.load(cid);
  return contractMenu(lifecycle.wallet, contractInstance, validationResult.scheme, validationResult.sourceMap);
}

/**
 * This is an Inquirer.js flow to interact with a contract
 */
async function contractMenu(
  wallet: WalletAPI,
  contractInstance: ContractInstanceAPI,
  scheme: DelayPaymentParameters,
  sourceMap: SourceMap<DelayPaymentAnnotations>
): Promise<void> {
  // Get and print the contract logical state.

  const inputHistory = await contractInstance.getInputHistory();
  const contractState = getState(datetoTimeout(new Date()), inputHistory, sourceMap);
  if (contractState.type === "Closed") return;

  printState(contractState, scheme);
  // See what actions are applicable to the current contract state
  const applicableActions = await contractInstance.evaluateApplicableActions();

  const choices: Array<{
    name: string;
    value: CanDeposit | CanAdvance | { type: "check-state" } | { type: "return" };
  }> = [
    {
      name: "Re-check contract state",
      value: { type: "check-state" },
    },
    ...applicableActions.myActions.map((action) => {
      switch (action.type) {
        case "Advance":
          return {
            name: "Close contract",
            description:
              contractState.type == "PaymentMissed"
                ? "The payer will receive minUTXO"
                : "The payer will receive minUTXO and the payee will receive the payment",
            value: action,
          };

        case "Deposit":
          return {
            name: `Deposit ${action.deposit.deposits} lovelaces`,
            value: action,
          };
        default:
          throw new Error("Unexpected action type");
      }
    }),
    {
      name: "Return to main menu",
      value: { type: "return" },
    },
  ];

  const selectedAction = await select({
    message: "Contract menu",
    choices,
  });
  switch (selectedAction.type) {
    case "check-state":
      return contractMenu(wallet, contractInstance, scheme, sourceMap);
    case "return":
      return;
    case "Advance":
    case "Deposit":
      console.log("Applying input");
      const applicableInput = await applicableActions.toInput(selectedAction);
      const txId = await applicableActions.apply({
        input: applicableInput,
      });
      console.log(`Input applied with txId ${txId}`);
      await waitIndicator(wallet, txId);
      return contractMenu(wallet, contractInstance, scheme, sourceMap);
  }
}

async function mainLoop(lifecycle: RuntimeLifecycle, rewardAddress?: StakeAddressBech32) {
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
          await createContractMenu(lifecycle, rewardAddress);
          break;
        case "load":
          await loadContractMenu(lifecycle);
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

// #region Delay Payment Contract
const delayPaymentTemplate = mkMarloweTemplate({
  name: "Delayed payment",
  description:
    "In a delay payment, a `payer` transfer an `amount` of ADA to the `payee` which can be redeemed after a `releaseDeadline`. While the payment is held by the contract, it can be staked to the payer, to generate pasive income while the payee has the guarantees that the money will be released.",
  params: [
    {
      name: "payer",
      description: "Who is making the payment",
      type: "address",
    },
    {
      name: "payee",
      description: "Who is receiving the payment",
      type: "address",
    },
    {
      name: "amount",
      description: "The amount of lovelaces to be paid",
      type: "value",
    },
    {
      name: "depositDeadline",
      description:
        "The deadline for the payment to be made. If the payment is not made by this date, the contract can be closed",
      type: "date",
    },
    {
      name: "releaseDeadline",
      description:
        "A date after the payment can be released to the receiver. NOTE: An empty transaction must be done to close the contract",
      type: "date",
    },
  ] as const,
});

/**
 * These are the parameters of the contract
 */
type DelayPaymentParameters = TemplateParametersOf<typeof delayPaymentTemplate>;

type DelayPaymentAnnotations = "initialDeposit" | "WaitForRelease" | "PaymentMissedClose" | "PaymentReleasedClose";

const DelayPaymentAnnotationsGuard = t.union([
  t.literal("initialDeposit"),
  t.literal("WaitForRelease"),
  t.literal("PaymentMissedClose"),
  t.literal("PaymentReleasedClose"),
]);

function mkDelayPayment(scheme: DelayPaymentParameters): ContractBundleMap<DelayPaymentAnnotations> {
  return {
    main: "initial-deposit",
    objects: {
      "release-funds": {
        type: "contract",
        value: {
          annotation: "WaitForRelease",
          when: [],
          timeout: datetoTimeout(scheme.releaseDeadline),
          timeout_continuation: close("PaymentReleasedClose"),
        },
      },
      "initial-deposit": {
        type: "contract",
        value: {
          annotation: "initialDeposit",
          when: [
            {
              case: {
                party: { address: scheme.payer },
                deposits: BigInt(scheme.amount),
                of_token: lovelace,
                into_account: { address: scheme.payee },
              },
              then: {
                ref: "release-funds",
              },
            },
          ],
          timeout: datetoTimeout(scheme.depositDeadline),
          timeout_continuation: close("PaymentMissedClose"),
        },
      },
    },
  };
}
// #endregion

// #region Delay Payment State
/**
 * The delay payment contract can be in one of the following logical states:
 */
type DelayPaymentState = InitialState | PaymentDeposited | PaymentMissed | PaymentReady | Closed;
/**
 * In the initial state the contract is waiting for the payment to be deposited
 */
type InitialState = {
  type: "InitialState";
};

/**
 * After the payment is deposited, the contract is waiting for the payment to be released
 */
type PaymentDeposited = {
  type: "PaymentDeposited";
};

/**
 * If the payment is not deposited by the deadline, the contract can be closed.
 * NOTE: It is not necesary to close the contract, as it will consume transaction fee (but it will release
 *       the minUTXO)
 */
type PaymentMissed = {
  type: "PaymentMissed";
};

/**
 * After the release deadline, the payment is still in the contract, and it is ready to be released.
 */
type PaymentReady = {
  type: "PaymentReady";
};

type Closed = {
  type: "Closed";
  result: "Missed deposit" | "Payment released";
};

function printState(state: DelayPaymentState, scheme: DelayPaymentParameters) {
  switch (state.type) {
    case "InitialState":
      console.log(`Waiting ${scheme.payer} to deposit ${scheme.amount}`);
      break;
    case "PaymentDeposited":
      console.log(`Payment deposited, waiting until ${scheme.releaseDeadline} to be able to release the payment`);
      break;
    case "PaymentMissed":
      console.log(`Payment missed on ${scheme.depositDeadline}, contract can be closed to retrieve minUTXO`);
      break;
    case "PaymentReady":
      console.log(`Payment ready to be released`);
      break;
    case "Closed":
      console.log(`Contract closed: ${state.result}`);
      break;
  }
}

function getState(
  currenTime: POSIXTime,
  history: SingleInputTx[],
  sourceMap: SourceMap<DelayPaymentAnnotations>
): DelayPaymentState {
  const Annotated = ObjG.Annotated(DelayPaymentAnnotationsGuard);
  const txOut = sourceMap.playHistory(history);
  if ("transaction_error" in txOut) {
    throw new Error(`Error playing history: ${txOut.transaction_error}`);
  }
  if (!Annotated.is(txOut.contract)) {
    throw new Error(`Contract is not annotated`);
  }

  switch (txOut.contract.annotation) {
    case "initialDeposit":
      if (currenTime > (txOut.contract as When).timeout) {
        return { type: "PaymentMissed" };
      } else {
        return { type: "InitialState" };
      }
    case "WaitForRelease":
      if (currenTime > (txOut.contract as When).timeout) {
        return { type: "PaymentReady" };
      } else {
        return { type: "PaymentDeposited" };
      }
    case "PaymentMissedClose":
      return { type: "Closed", result: "Missed deposit" };
    case "PaymentReleasedClose":
      return { type: "Closed", result: "Payment released" };
  }
}

// #endregion

type ValidationResults =
  | "InvalidMarloweTemplate"
  | "InvalidContract"
  | {
      scheme: DelayPaymentParameters;
      sourceMap: SourceMap<DelayPaymentAnnotations>;
    };

/**
 * This function checks if the contract with the given id is an instance of the delay payment contract
 * @param lifecycle
 * @param contractId
 * @returns
 */
async function validateExistingContract(
  lifecycle: RuntimeLifecycle,
  contractId: ContractId
): Promise<ValidationResults> {
  // First we try to fetch the contract details and the required tags
  const contractDetails = await lifecycle.restClient.getContractById({
    contractId,
  });

  const scheme = delayPaymentTemplate.fromMetadata(contractDetails.metadata);

  if (!scheme) {
    return "InvalidMarloweTemplate";
  }

  // If the contract seems to be an instance of the contract we want (meanin, we were able
  // to retrieve the contract scheme) we check that the actual initial contract has the same
  // sources.
  // This has 2 purposes:
  //   1. Make sure we are interacting with the expected contract
  //   2. Share the same sources between different Runtimes.
  //      When a contract source is uploaded to the runtime, it merkleizes the source code,
  //      but it doesn't share those sources with other runtime instances. One option would be
  //      to download the sources from the initial runtime and share those with another runtime.
  //      Or this option which doesn't require runtime to runtime communication, and just requires
  //      the dapp to be able to recreate the same sources.
  const sourceMap = await mkSourceMap(lifecycle, mkDelayPayment(scheme));
  const isInstanceof = await sourceMap.contractInstanceOf(contractId);
  if (!isInstanceof) {
    return "InvalidContract";
  }
  return { scheme, sourceMap };
}

async function main() {
  const args = parseCli();
  const config = await readConfig(args["--config"]);
  const lucid = await Lucid.new(new Blockfrost(config.blockfrostUrl, config.blockfrostProjectId), config.network);
  lucid.selectWalletFromSeed(config.seedPhrase);
  const rewardAddressStr = await lucid.wallet.rewardAddress();
  const rewardAddress = rewardAddressStr ? stakeAddressBech32(rewardAddressStr) : undefined;
  const runtimeURL = config.runtimeURL;

  const wallet = mkLucidWallet(lucid);

  const lifecycle = mkRuntimeLifecycle({
    runtimeURL,
    wallet,
  });
  try {
    await mainLoop(lifecycle, rewardAddress);
  } catch (e) {
    console.log(`Error : ${JSON.stringify(e, null, 4)}`);
  }
}
