import { mkLucidWallet } from "@marlowe.io/wallet";
import { Lucid, Blockfrost } from "lucid-cardano";
import { readConfig } from "./config.js";

const log = console.log.bind(console);

async function main() {
  const config = await readConfig();
  const lucid = await Lucid.new(new Blockfrost(config.blockfrostUrl, config.blockfrostProjectId), config.network);
  lucid.selectWalletFromSeed(config.seedPhrase);

  const wallet = mkLucidWallet(lucid);

  const isMainnet = await wallet.isMainnet();
  log(` * Network from API:  ${isMainnet ? "Mainnet" : "Testnet"}`);
  log(` * Network from lucid: ${lucid.network}`);
  const lovelaces = await wallet.getLovelaces();
  log(` * Lovelaces: ${lovelaces}`);
  log("");
  const tokensResult = await wallet.getTokens();
  log(`* Tokens: (${tokensResult.length} tokens)`);
  tokensResult.map((token) => {
    const tokenName = token.assetId.assetName == "" ? "lovelaces" : token.assetId.assetName;
    log(`   ${tokenName} - ${token.quantity}`);
  });
  log("");
  const changeAddress = await wallet.getChangeAddress();
  log("* Change Address: " + changeAddress);
  log("");

  const usedAddresses = await wallet.getUsedAddresses();
  log(`* Used Addresses: (${usedAddresses.length} addresses)`);
  usedAddresses.map((usedAddress) => log("    - " + usedAddress));
  log("");

  const collaterals = await wallet.getCollaterals();
  log(`* Collaterals: (${collaterals.length} collaterals)`);
  collaterals.map((collateral) => log("    - " + collateral));
  log("");

  const utxos = await wallet.getUTxOs();
  log(`* UTxOs: (${utxos.length} utxos)`);
  utxos.map((utxo) => log("    - " + utxo));
  log("");
  log("Wallet flow done 🎉");
}

main().catch((error) => {
  console.error("Error during main execution:", error);
});
