# Description

This package provides wallet functionality for the rest of the SDK packages.

It has the following modules:

- @{@link api | marlowe.io/wallet/api}: provides an abstract interface to work with a wallet.
- @{@link browser | marlowe.io/wallet/browser}: provides a browser implementation of the api using the [CIP30 specification](https://cips.cardano.org/cips/cip30/).
- @{@link lucid | marlowe.io/wallet/lucid}: provides a implementation of the api that can work in the browser, node.js and deno using [Lucid](https://github.com/spacebudz/lucid).
- @{@link index | marlowe.io/wallet}: Re-exports of the other modules.

[comment]: # "nodejs: provides a server implementation of the api using Lucid NOTE: the underlying library might be replaced in the future - for the momment disabled until we discuss the Node module"

## Getting started

The `@marlowe.io/wallet` package is [released as an ESM module](https://github.com/input-output-hk/marlowe-ts-sdk/blob/main/doc/modules-system.md) and can be used with a modern bundler or imported directly in the browser (without any bundler) as long as you use an import map.

### Browser

```html
<html>
  <body>
    <script src="https://cdn.jsdelivr.net/gh/input-output-hk/marlowe-ts-sdk@0.4.0-beta/jsdelivr-npm-importmap.js"></script>
    <script type="module">
      import { mkBrowserWallet, getInstalledWalletExtensions } from "@marlowe.io/wallet";

      const installedWalletExtensions = getInstalledWalletExtensions();
      console.log(`Available Browser Wallet Extensions: ${installedWalletExtensions}`);
      const wallet = await mkBrowserWallet(installedWalletExtensions[0]);
    </script>
  </body>
</html>
```

## Examples

There is a simple HTML file in the [examples folder](https://github.com/input-output-hk/marlowe-ts-sdk/blob/main/examples/wallet-flow/index.html) that shows how to use the wallet package to connect to a wallet extension and get basic info.
