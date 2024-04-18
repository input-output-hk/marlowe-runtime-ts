import { mkRestClient } from "@marlowe.io/runtime-rest-client";
import { MarloweJSON } from "@marlowe.io/adapter/codec";
import { clearConsole, log, logJSON } from "../js/poc-helpers.js";
import { mkPeerConnectAdapter } from "@marlowe.io/wallet/peer-connect";
import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";

import * as H from "../js/poc-helpers.js";

window.restClient = null;
function getRestClient() {
  if (window.restClient === null) {
    const runtimeURL = H.getRuntimeUrl();
    window.restClient = mkRestClient(runtimeURL);
  }
  return window.restClient;
}
const runtimeUrlInput = document.getElementById("runtimeUrl");
runtimeUrlInput.addEventListener("change", () => {
  window.restClient = null;
});

const clearConsoleButton = document.getElementById("clear-console");
clearConsoleButton.addEventListener("click", clearConsole);

H.setupLocalStorageRuntimeUrl();

const adapter = mkPeerConnectAdapter();
adapter.onDeleteWallet(async (walletId) => {
  updateDisconnectedWalletStatus();
});
adapter.onNewWallet(async (walletId, wallet) => {
  updateConnectedWalletStatus(wallet);
});
window.adapter = adapter;

// Give your app some basic information that will be displayed to the client wallet when he is connecting to your DApp.
const dAppInfo = {
  name: "Cip45 test",
  url: "http://localhost:1337/examples",
};
// Define a function that will be called when the client tries to connect to your DApp.
const verifyConnection = (walletInfo, callback) => {
  logJSON("walletInfo", walletInfo);
  callback(
    //
    window.confirm(`Do you want to connect to wallet ${walletInfo.name} (${walletInfo.address})?`)
  );
};

function updateDisconnectedWalletStatus() {
  document.getElementById("connected-wallet").style.display = "none";
  document.getElementById("qr-code").style.display = "block";
}

async function updateConnectedWalletStatus(wallet) {
  const address = await wallet.getChangeAddress();
  const balance = await wallet.getLovelaces();
  const addressElm = document.getElementById("connected-wallet-address");
  const balanceElm = document.getElementById("connected-wallet-balance");
  addressElm.textContent = address;
  balanceElm.textContent = balance;

  document.getElementById("connected-wallet").style.display = "block";
  document.getElementById("qr-code").style.display = "none";
}

const dAppConnect = new CardanoPeerConnect.DAppPeerConnect({
  dAppInfo: dAppInfo,
  verifyConnection: verifyConnection,
  onApiInject: adapter.adaptApiInject,
  onApiEject: adapter.adaptApiEject,
});
window.dAppConnect = dAppConnect;

document.getElementById("disconnect-wallet").addEventListener("click", async () => {
  // NOTE: dAppConnect doesn't have a disconnect method, and this is currently
  //       not working. It's not clear how to disconnect from the wallet.
  //       https://github.com/fabianbormann/cardano-peer-connect/issues/57
  logJSON("adapter", adapter);
  logJSON("dAppConnect", dAppConnect);
  const walletInfo = { version: 1, name: "a", icon: "bubu" };
  dAppConnect.meerkat.api.disconnect(
    // dAppConnect.dAppInfo.address,
    dAppConnect.connectedWallet,
    walletInfo,
    (connectStatus) => {
      console.log(connectStatus);
      debugger;
    }
  );
});

document.getElementById("create-contract").addEventListener("click", async () => {
  const wallet = adapter.getWallet();
  const runtime = mkRuntimeLifecycle({
    runtimeURL: H.getRuntimeUrl(),
    wallet,
  });

  const [contractId, txId] = await runtime.contracts.createContract({
    contract: "close",
    tags: {
      "cip-45": "true",
    },
  });

  log(`contractId: ${contractId}`);
  log(`waiting for txId ${txId}`);
  await wallet.waitConfirmation(txId);
  log("transaction confirmed");
});

document.getElementById("wallet-flow").addEventListener("click", async () => {
  const wallet = adapter.getWallet();
  log(`<h2>CIP-45 Wallet Extension</h2>`);
  log("");
  log("Reading Wallet information...");
  log("");

  const isMainnet = await wallet.isMainnet();
  log(`* <b>Network</b>: ${isMainnet ? "Mainnet" : "Testnet"}`);
  log("");

  const lovelaces = await wallet.getLovelaces();
  log("- <b>Lovelaces</b>: " + lovelaces);
  const tokensResult = await wallet.getTokens();
  log("");

  log(`- <b>Tokens</b>: (${tokensResult.length} tokens)`);
  tokensResult.map((token) => {
    const tokenName = token.assetId.assetName == "" ? "lovelaces" : token.assetId.assetName;
    log(`&nbsp;&nbsp;&nbsp; <i>${tokenName}</i> - ${token.quantity}`);
  });
  log("");

  const changeAddress = await wallet.getChangeAddress();
  log("- <b>Change Address</b>: " + changeAddress);
  log("");

  const usedAddresses = await wallet.getUsedAddresses();
  log(`- <b>Used Addresses</b>: (${usedAddresses.length} addresses)`);
  usedAddresses.map((usedAddress) => log("&nbsp;&nbsp;&nbsp; - " + usedAddress));
  log("");

  const collaterals = await wallet.getCollaterals();
  log(`- <b>Collaterals</b>: (${collaterals.length} collaterals)`);
  collaterals.map((collateral) => log("&nbsp;&nbsp;&nbsp; - " + collateral));
  log("");

  const utxos = await wallet.getUTxOs();
  log(`- <b>UTxOs</b>: (${utxos.length} utxos)`);
  utxos.map((utxo) => log("&nbsp;&nbsp;&nbsp; - " + utxo));
  log("");
  log("Wallet flow done 🎉");
});
// This is the code (identifier) that the client needs to enter into the wallet to connect to your dapp
const clientConnectCode = dAppConnect.getAddress();
document.getElementById("connection-id").innerText = clientConnectCode;

// Create and insert a QR code on your DApp, so the user can scan it easily in their app
dAppConnect.generateQRCode(document.getElementById("qr-code"));
