import { log, logJSON } from "../../js/poc-helpers.js";
import * as H from "../../js/poc-helpers.js";
import { decryptChunks, setPrivateKey } from "./custodian-encript.js";
import * as G from "@marlowe.io/language-core-v1/guards";

H.setupWallet();
H.setupClearConsole();
H.setupLocalStorageRuntimeUrl();

const loadContractInput = document.getElementById("load-contract");
loadContractInput.addEventListener("click", H.tryCatchEvent(loadContract));

const setDecryptionKeyInput = document.getElementById("set-decryption-key");
setDecryptionKeyInput.addEventListener(
  "click",
  H.tryCatchEvent(() => setPrivateKey(document.getElementById("decryption-key").value))
);

async function loadContract() {
  log("Loading contract");
  const contractId = document.getElementById("contract-id").value;
  const restClient = await H.getRestClient();
  const paginatedTxs = await restClient.getTransactionsForContract({
    contractId,
  });
  if (paginatedTxs.transactions.length !== 1) {
    log("Expected 1 transaction for contract, got " + paginatedTxs.transactions.length);
    logJSON("transactions", paginatedTxs);
    return;
  }
  logJSON("txId", paginatedTxs.transactions[0].transactionId);
  const txId = paginatedTxs.transactions[0].transactionId;
  const answerTx = await restClient.getContractTransactionById({
    contractId,
    txId,
  });

  const answers = await getAnswers(answerTx);
  logJSON("answers", answers);
  window.contractId = contractId;
  H.setContractIdIndicator(window.contractId, "contract-id-indicator");

  const giveRewardButton = document.getElementById("give-reward");
  giveRewardButton.disabled = false;
}

const questionMap = {
  answer1: "1. I’d like to use/recommend Marlowe for future dApps",
  answer2: "2. The survey contract was easy to design",
  answer3: "3. This tutorial is helpful",
  answer4: "4. I am an experienced web3 developer",
  answer5: "5. Please share any comments (240 char max)",
};

const answerMap = {
  5: "Highly agree",
  4: "Agree",
  3: "Neutral",
  2: "Disagree",
  1: "Strongly disagree",
};

async function getAnswers(answerTx) {
  const inputs = answerTx.inputs;
  const answers = {};
  for (const input of inputs) {
    const choiceName = input.for_choice_id.choice_name;
    const choiceNum = input.input_that_chooses_num;
    const questionName = questionMap[choiceName];
    if (choiceName !== "answer5") {
      answers[questionName] = answerMap[choiceNum];
    } else {
      const decrypted = await decryptChunks(answerTx.tags);
      answers[questionName] = decrypted.decrypted;
      if (decrypted.lastDigitsDecimal !== choiceNum) {
        log("⛔️ Warning: Last digits do not match");
      } else {
        log("✅ Decrypted message matches on chain hash");
      }
    }
  }

  return answers;
}
