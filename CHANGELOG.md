# 0.3.0-beta - 18 Jan 2024

The Marlowe team is happy to announce the 0.3.0 release with the following Milestones completed:

- Add Node.js/Deno support
- Completed 1-1 feature parity between the TS-SDK and Runtime 0.0.6
- Added an open role example
- Added a marlowe-object (merkleized contracts) example

A more detailed description of the changes can be found next

## General

- Feat (PLT-8693): Added Node.js support ([PR-114](https://github.com/input-output-hk/marlowe-ts-sdk/pull/114))

- Feat (PLT-8836): Changed documentation theme. ([PR-122](https://github.com/input-output-hk/marlowe-ts-sdk/pull/122))

- Feat: Added debugging configuration for VSCode. Now if you are developing with VSCode you can open the folder as a workspace and the [Javascript Debug Terminal](https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_javascript-debug-terminal) will have the appropiate source maps. ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136)).

- Feat: Started an experimental getApplicableActions that should replace the current getApplicableInputs. ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136))

- Fix (PLT-8889): Solved issues with the github actions that run the tests ([PR-121](https://github.com/input-output-hk/marlowe-ts-sdk/pull/121))

- CI (PLT-8890): Stop automatic docs deployment from main and update release instructions ([#2f266ff](https://github.com/input-output-hk/marlowe-ts-sdk/commit/2f266ffe303bf1f16f6df0dc83e2e6716c272590))

- Fix (PLT-9008): Fix documentation warnings and add a CI check to avoid them in the future. ([PR-139](https://github.com/input-output-hk/marlowe-ts-sdk/pull/139))

## Examples

- Feat: Added a new interactive NodeJs example to make delayed payments with staking and merkleization. ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136))

## @marlowe.io/wallet

- Feat (PLT-8693): Added a Lucid implementation that works on the Browser/NodeJs/Deno ([PR-114](https://github.com/input-output-hk/marlowe-ts-sdk/pull/114))

## @marlowe.io/adapter

- Feat: Added a bigint utilities adapter. ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136))
- Feat: Added iso8601ToPosixTime to the time adapter. ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136))

## @marlowe.io/language-core-v1

- Feat: Added SingleInputTx to capture a single step transaction (either a single input or an empty tx). ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136)).
- Feat: Added getNextTimeout to see what is the next timeout of a contract. ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136)).
- Fix: Fix how merkleized inputs are serialized ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136)).
- Fix: Solved a semantic issue with assoc list where delete was duplicating entries. ([PR-159](https://github.com/input-output-hk/marlowe-ts-sdk/pull/159))

## @marlowe.io/language-examples

- Feat: New swap contract version added, A simple Swap was initially implemented to test the runtime-lifecycle APIs. We have replaced this version with a more elaborated one that will be used in the [Order Book Swap Prototype](https://github.com/input-output-hk/marlowe-order-book-swap). For more details see [@marlowe.io/language-examples](https://input-output-hk.github.io/marlowe-ts-sdk/modules/_marlowe_io_language_examples.html) ([PR](https://github.com/input-output-hk/marlowe-ts-sdk/pull/131))

## @marlowe.io/runtime-rest-client

- **BREAKING CHANGE** Refactor: `createContract` Endpoint has been renamed to `buildCreateContractTx` ([PR-54](https://github.com/input-output-hk/marlowe-ts-sdk/pull/54))
- **BREAKING CHANGE** Refactor: Extracted Pagination logic for the 4 collection queries (added total count of the query and current Page information ) ([PR-142](https://github.com/input-output-hk/marlowe-ts-sdk/pull/142))
  - The 4 queries response structure have changed :
    - from : `json {headers : {..}, previousRange : ".." , next:".." }`
    - to :
      - `json {contracts: {..}, page : {..} }`
      - or `json {transactions: {..}, page : {..} }`
      - or `json {payouts: {..}, page : {..} }`
      - or `json {withdrawals: {..}, page : {..} }`
- **BREAKING CHANGE** Refactor: Create contract sources now uses a single parameter ContractBundle, instead of two separate bundle and main entrypoint parameters. ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136))
- **BREAKING CHANGE** Feat: Modified the endpoint `healthcheck` to return `RuntimeStatus`(version deployed, Network Id of the Node and tips) instead of a `boolean`. ([PR-158](https://github.com/input-output-hk/marlowe-ts-sdk/pull/158))
- **BREAKING CHANGE** Fix: Pagination responses not always return a current header. ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136))

- Feat (PLT-7704): Extend the rest client with procedure `getPayouts`. ([PR-124](https://github.com/input-output-hk/marlowe-ts-sdk/pull/124))
- Feat (PLT-7705): Extend the rest client with procedure `getPayoutById`. ([PR-124](https://github.com/input-output-hk/marlowe-ts-sdk/pull/124))
- Feat (PLT-7701): Extend the rest client with procedure `getContractSourceById`. ([PR-128](https://github.com/input-output-hk/marlowe-ts-sdk/pull/128))
- Feat (PLT-7702): Extend the rest client with procedure `getContractSourceAdjacency`. ([PR-128](https://github.com/input-output-hk/marlowe-ts-sdk/pull/128))
- Feat (PLT-7703): Extend the rest client with procedure `getContractSourceClosure`. ([PR-128](https://github.com/input-output-hk/marlowe-ts-sdk/pull/128))
- Feat (PLT-8427): Extend the rest client with procedure `getNextStepsForContract`. ([PR-128](https://github.com/input-output-hk/marlowe-ts-sdk/pull/128))
- Feat: Added `@marlowe.io/runtime-rest-client/guards` in a similar way as `@marlowe.io/labguage-core-v1/guards` ([PR-142](https://github.com/input-output-hk/marlowe-ts-sdk/pull/142))
- Fix: Revived integration tests ([PR-142](https://github.com/input-output-hk/marlowe-ts-sdk/pull/142))

## @marlowe.io/runtime-core

- **BREAKING CHANGE** Refactor: `AddressBech32` is a branded type instead of newtype (`unAddressBech32` has been removed and is not necessary anymore) : [PR-127](https://github.com/input-output-hk/marlowe-ts-sdk/pull/127)

- **BREAKING CHANGE** Refactor: `PolicyId` is a Branded Type instead of a Newtype ([PR-142](https://github.com/input-output-hk/marlowe-ts-sdk/pull/142))
- **BREAKING CHANGE** Refactor: `ContractId` is a Branded Type instead of a Newtype ([PR-142](https://github.com/input-output-hk/marlowe-ts-sdk/pull/142))
- Feat: added `TokensMap` and `AssetsMap` ([PR-142](https://github.com/input-output-hk/marlowe-ts-sdk/pull/142))

## @marlowe.io/runtime-lifecycle

- Feat (PLT-8693): Added a top-level `mkRuntimeLifecycle` that receives a wallet implementation instead of automatically creating one ([PR-114](https://github.com/input-output-hk/marlowe-ts-sdk/pull/114))

- Feat: `createContract` is complete request-wise for creating non-merkleized contracts ([PR-54](https://github.com/input-output-hk/marlowe-ts-sdk/pull/54))

- Feat: Added restClient to the lifecycle object for easier querying. ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136))
- Feat: Added getInputHistory to get a list of SingleInputTx applied to a contract. ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136))

## @marlowe.io/marlowe-object

- Feat: Added ContractBundle to represent a bundle with a main entrypoint. ([PR-136](https://github.com/input-output-hk/marlowe-ts-sdk/pull/136))

# 0.2.0-beta - 04 Dec 2023

## General

- Reformat code with [prettier](https://prettier.io/) and [alejandra](https://github.com/kamadorueda/alejandra) using the [treefmt](https://github.com/numtide/treefmt-nix) tool

- Improved the way the SDK gets imported in the browser by the use of importmaps. Included import documentation in each package.

- Renamed the global `pocs` folder to `examples`

- Fix url generation on the import maps.

- Introduced the @marlowe.io/marlowe-object package to facilitate the creation of large contracts using Merkleization.

- Added typedoc documentation.

## @marlowe.io/wallet

- Renamed the `pocs/runtimeCIP30Flow.html` to `pocs/wallet-flow.html` and modified it to highlight the wallet capabilities.

- **BREAKING CHANGE:** Removed `fp-ts` from the user facing API.
- **BREAKING CHANGE:** In the browser module `getExtensionInstance` was renamed to `mkBrowserWallet`

- **BREAKING CHANGE**: Renamed signTxTheCIP30Way to signTx

- **BREAKING CHANGE**: Refactored getNetworkCIP30 to isMainnet

- Added lace to supported wallets

- Added `getInstalledWalletExtensions` instead of `getAvalaibleWallets`

## @marlowe.io/language-core-v1

- Moved the examples to the `@marlowe.io/language-examples` package.

- **BREAKING CHANGE**: Modify the exported modules to have the JSON types in the main export and the runtime validations under a `/guards` module.

- Added a compatibility mode for the Playground's `marlowe-js` internal library. This is exported under the `@marlowe.io/language-core-v1/playground-v1` module.

- Add `computeTransaction` and `playTrace` semantics

## @marlowe.io/language-examples

- Add Survey example

- Added Vesting Contract

## @marlowe.io/runtime-rest-client

- **BREAKING CHANGE**: Replaced mkRestClient interface for a flat API that resembles the backend documentation structure.

- modified the `next` endpoint to be compliant with `runtime-web v0.0.5.1`

- Added the endpoint `createContractSources`

- Removed filter from return on `getContracts` endpoint

## @marlowe.io/runtime-lifecycle

- **BREAKING CHANGE:** Removed `fp-ts` from the user facing API

- Fixed `this undefined` issues when calling `mkRuntimeLifecycle`

- Lower the abstraction level of `ContractLifecyleAPI`

- An API consumer may retrieve all contract ids for contracts that mentions their users wallet addresses with method `getContractIds`.
