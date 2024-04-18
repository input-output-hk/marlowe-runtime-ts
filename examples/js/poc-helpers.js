import { MarloweJSON } from "@marlowe.io/adapter/codec";
import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle/browser";
import { mkRestClient } from "@marlowe.io/runtime-rest-client";
import { mkBrowserWallet, getInstalledWalletExtensions } from "@marlowe.io/wallet";

export function clearConsole() {
  const consoleDiv = document.getElementById("console");
  consoleDiv.innerHTML = "";
}

export function setConsoleElement(elm) {
  window.consoleDiv = elm;
}

function getConsoleElement() {
  return window.consoleDiv || document.getElementById("console");
}
export function log(message) {
  const consoleDiv = getConsoleElement();
  var currentContent = consoleDiv.innerHTML;
  consoleDiv.innerHTML = currentContent + "<BR>" + message;
  console.log(message);
}

export function logJSON(message, json) {
  const consoleDiv = getConsoleElement();
  var currentContent = consoleDiv.innerHTML;
  consoleDiv.innerHTML = `${currentContent}<BR>${message}<pre><code class="language-json">${MarloweJSON.stringify(
    json,
    null,
    4
  )}</code></pre>`;
  console.log(message, json);
}

export function getRuntimeUrl() {
  const runtimeUrlInput = document.getElementById("runtimeUrl");
  return (runtimeUrlInput && runtimeUrlInput.value) || "https://marlowe-runtime-preprod-web.demo.scdev.aws.iohkdev.io/";
}

export function setupLocalStorageRuntimeUrl() {
  const runtimeUrlInput = document.getElementById("runtimeUrl");
  const runtimeUrl = localStorage.getItem("runtimeUrl");
  if (runtimeUrl) {
    runtimeUrlInput.value = runtimeUrl;
  }
  runtimeUrlInput.addEventListener("change", () => {
    localStorage.setItem("runtimeUrl", runtimeUrlInput.value);
    window.restClient = null;
    window.runtimeLifecycle = null;
  });
}

export function setupClearConsole() {
  const clearConsoleButton = document.getElementById("clear-console");
  clearConsoleButton.addEventListener("click", clearConsole);
}

export function setupWallet() {
  const walletInput = document.getElementById("wallet");
  const installedWalletExtensions = getInstalledWalletExtensions();
  if (installedWalletExtensions.length === 0) {
    const option = document.createElement("option");
    option.value = "invalid";
    option.text = "No wallet available";
    walletInput.add(option);
    walletInput.disabled = true;
  } else {
    installedWalletExtensions.forEach((installedWalletExtension) => {
      const option = document.createElement("option");
      option.value = installedWalletExtension.name;
      option.text = installedWalletExtension.name.charAt(0).toUpperCase() + installedWalletExtension.name.slice(1);
      walletInput.add(option);
    });
  }
  walletInput.addEventListener("change", () => {
    window.restClient = null;
    window.runtimeLifecycle = null;
  });
}

export function getWallet() {
  const walletInput = document.getElementById("wallet");
  const walletName = walletInput.value;
  return mkBrowserWallet(walletName);
}

export function getRestClient() {
  if (typeof window.restClient == "undefined" || window.restClient == null) {
    const runtimeURL = getRuntimeUrl();
    window.restClient = mkRestClient(runtimeURL);
  }
  return window.restClient;
}

export async function getLifecycle() {
  if (typeof window.runtimeLifecycle == "undefined" || window.runtimeLifecycle == null) {
    const walletInput = document.getElementById("wallet");
    const walletName = walletInput.value;
    const runtimeURL = getRuntimeUrl();

    window.runtimeLifecycle = await mkRuntimeLifecycle({
      walletName,
      runtimeURL,
    });
  }
  return window.runtimeLifecycle;
}

export function setContractIdIndicator(contractId, indicatorId, network = "preprod") {
  const contractIdIndicator = document.getElementById(indicatorId);
  contractIdIndicator.innerHTML = contractId;
  const url = `https://${network}.marlowescan.com/contractView?tab=state&contractId=${contractId.replace("#", "%23")}`;
  contractIdIndicator.href = url;
  contractIdIndicator.target = "_blank";
}

export function tryCatchEvent(handler) {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (e) {
      log(
        `<span style="color: red">Error:</span><br><pre>${e}</pre><br>Open the browser's console and network tab for more details`
      );
      throw e;
    }
  };
}

/**
 * This function setups <pre><code></code></pre> syntax highlighting using
 * https://highlightjs.org/. It is expected that hljs is available in the global
 * object.
 */
export function setupCodeHighlighting() {
  // Highlight any existing element
  hljs.highlightAll();
  // Use a mutation observer to identify new blocks to highlight
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.tagName === "PRE" && node.children[0]?.tagName === "CODE") {
            hljs.highlightElement(node.children[0]);
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
