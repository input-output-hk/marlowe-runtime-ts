import arg from "arg";

import { mkLucidWallet } from "@marlowe.io/wallet";
import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";
import { escrow as mkEscrow } from "@marlowe.io/language-examples";
import { Lucid, Blockfrost } from "lucid-cardano";
import { readConfig } from "./config.js";
import { datetoTimeout } from "@marlowe.io/language-core-v1";
import { addressBech32 } from "@marlowe.io/runtime-core";

const args = arg({
  "--help": Boolean,
  "--sell-to": String,
  "--buy-from": String,
  "--mediator": String,
  "--amount": Number,
  "-a": "--amount",
});

if (args["--help"]) {
  printHelp(0);
}

const sellTo = args["--sell-to"];
const buyFrom = args["--buy-from"];

if (sellTo && buyFrom) {
  fail("You can only choose either --sell-to or --buy-from, but not both");
}
const action = sellTo ? "sell" : "buy";
const address = (sellTo || buyFrom) ?? fail("You must choose either --sell-to or --buy-from");
const amount = args["--amount"] ?? fail("You must specify the amount of lovelace to escrow");

const mediator = args["--mediator"] ?? fail("You must specify the mediator address");
main(action, address, amount, mediator);

function fail(message: string) {
  console.error("********** ERROR **********");
  console.error(message);
  console.error("");
  console.error("");
  console.error("");
  return printHelp(1);
}

function printHelp(exitStatus: number): never {
  console.log("Usage: npm run escrow -- <sell-to | buy-from> <amount> <mediator>");
  console.log("");
  console.log("Example:");
  console.log("  npm run escrow -- --sell-to addr1_af33.... -a 10000000 --mediator addr1_... ");
  console.log("Options:");
  console.log("  --help: Print this message");
  console.log("  action:");
  console.log("     --sell-to: The address of the buyer");
  console.log("     --buy-from: The address of the seller");
  console.log("  --amount: The amount of lovelace to escrow");
  console.log("  --mediator: The address of the mediator");
  process.exit(exitStatus);
}

async function main(action: "buy" | "sell", otherAddress: string, amount: number, mediator: string) {
  const { runtimeURL, blockfrostUrl, blockfrostProjectId, network, seedPhrase } = await readConfig();
  const lucid = await Lucid.new(new Blockfrost(blockfrostUrl, blockfrostProjectId), network);
  lucid.selectWalletFromSeed(seedPhrase);

  const wallet = mkLucidWallet(lucid);
  const walletAddress = await wallet.getChangeAddress();

  const Buyer = action === "sell" ? addressBech32(otherAddress) : walletAddress;
  const Seller = action === "sell" ? walletAddress : addressBech32(otherAddress);
  const Mediator = addressBech32(mediator);

  const runtime = mkRuntimeLifecycle({
    runtimeURL,
    wallet,
  });

  const escrow = mkEscrow({
    price: amount,
    depositTimeout: datetoTimeout(new Date("2035-01-01")),
    disputeTimeout: datetoTimeout(new Date("2035-01-02")),
    answerTimeout: datetoTimeout(new Date("2035-01-03")),
    arbitrageTimeout: datetoTimeout(new Date("2035-01-04")),
  });
  console.log("Creating contract...");
  console.log("Buyer: " + Buyer);
  console.log("Seller: " + Seller);
  console.log("Mediator: " + Mediator);
  console.log("Amount: " + amount);

  const [contractId, txId] = await runtime.contracts.createContract({
    contract: escrow,
    roles: { Buyer, Seller, Mediator },
  });

  console.log("Contract ID: " + contractId);
  console.log("Transaction ID: " + txId);

  console.log("Waiting for confirmation...");
  await wallet.waitConfirmation(txId);
  console.log("Contract created successfully!");
}
