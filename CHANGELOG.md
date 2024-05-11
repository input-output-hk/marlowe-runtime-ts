
# 0.4.0-beta - 11th May 2024

## General

- Feat: Created a new experimental package `@marlowe.io/marlowe-template` that helps to share the parameters used in the creation of a Marlowe contract. ([PR-184](https://github.com/input-output-hk/marlowe-ts-sdk/pull/184))

- Feat: **Initial Account Deposits Feature Integration (Runtime v1.0.0):**

  - **Purpose:** This update introduces the capability for users to make initial deposits into their accounts upon creation. This feature aims to streamline the account setup process and enhance user experience.
  - **Benefits:** This feature squashes the Contract Creation and Initial Input Deposits into 1 transaction instead of multiple ones.

- Feat: **Introduction of a New Contract API in the Runtime Lifecycle API:**
  - **Purpose:** The addition of a new Contract API is designed to provide developers with more flexibility and control (contract instance concept) over smart contract management within the runtime environment.
  - **Benefits:** Developers can now leverage enhanced functionalities for deploying, updating, and interacting with smart contracts. This API simplifies complex contract operations and supports more robust smart contract development.

## @marlowe.io/wallet

- Feat: Added a `@marlowe.io/wallet/peer-connect` module to enable mobile support by adapting to the [cardano-peer-connect](https://github.com/fabianbormann/cardano-peer-connect) library. ([PR-179](https://github.com/input-output-hk/marlowe-ts-sdk/pull/179))

## @marlowe.io/language-examples

- Feat: `Atomic swap v2` : Simplified version using the new runtime `v1.0.0` feature (`initial account deposits`)
  - see end-to-end tests for examples (e.g : `swap.ada.token.e2e.spec.ts`)

## @marlowe.io/runtime-rest-client

- `mkRestClient` provides optional `strict` parameter for performing dynamic type checking in `RestClient` methods. ([PR-180](https://github.com/input-output-hk/marlowe-ts-sdk/pull/180))
- **BREAKING CHANGE** The following `RestClient` methods use a keyword argument object instead of positional arguments. ([PR-180](https://github.com/input-output-hk/marlowe-ts-sdk/pull/180))
  - `createContractSources`
  - `getContractById`
  - `submitContract`
  - `getTransactionsForContract`
  - `submitContractTransaction`
  - `getContractTransactionById`
  - `getWithdrawalById`
  - `submitWithdrawal`

- Feat: `initial account deposits` (runtime v1.0.0) for Contract Creation (`BuildCreateContractTxRequest` via `buildCreateContractTx`):([PR-188](https://github.com/input-output-hk/marlowe-ts-sdk/pull/188))

## @marlowe.io/runtime-core

- Feat: Added AddressBech32 validation using the lucid library ([PR-184](https://github.com/input-output-hk/marlowe-ts-sdk/pull/184))
- Fix: Added proper type guards to Metadata ([PR-184](https://github.com/input-output-hk/marlowe-ts-sdk/pull/184))

- Fix: Branding of ContractId and TxId ([PR-185](https://github.com/input-output-hk/marlowe-ts-sdk/pull/185))

- Feat: `initial account deposits` (runtime v1.0.0) for Contract Creation ([PR-188](https://github.com/input-output-hk/marlowe-ts-sdk/pull/188)):
  - Added `export type AccountDeposits = { [key in AddressOrRole]: AssetsMap };` and associated utility functions.

## @marlowe.io/runtime-lifecycle

- Feat (PLT-9089): Added support for contract bundles in the `lifecycle.contracts.createContract` function. ([PR-167](https://github.com/input-output-hk/marlowe-ts-sdk/pull/167))

- `mkRuntimeLifecycle` provides optional `strict` parameter for performing dynamic type checking in `RestClient` methods. ([PR-180](https://github.com/input-output-hk/marlowe-ts-sdk/pull/180))

- Fix: Temporal fix for converting the cardano time interval to the Marlowe time interval in getInputHistory ([PR-181](https://github.com/input-output-hk/marlowe-ts-sdk/pull/181))

- Feat: Added a new experimental API for computing, simulating and applying the next applicable Actions/Inputs. ([PR-187](https://github.com/input-output-hk/marlowe-ts-sdk/pull/187))
- Doc: Improved package main documentation ([PR-187](https://github.com/input-output-hk/marlowe-ts-sdk/pull/187))

- Feat: New Contract API `packages/runtime/lifecycle/src/generic/new-contract-api.ts` ([PR-188](https://github.com/input-output-hk/marlowe-ts-sdk/pull/188)):
  - Generic `waitConfirmation()` : same for contract creation and apply inputs
  - Seamless Integration of Applicable Actions API
  - simplfied interface (`create` and `load` with a concept of `ContractInstance` object)
  - see end-to-end tests for examples (e.g : `swap.ada.token.e2e.spec.ts`)
- Feat: `initial account deposits` feature (runtime v1.0.0) for Contract Creation ([PR-188](https://github.com/input-output-hk/marlowe-ts-sdk/pull/188)):
  - new parameter field `accountDeposits` in
  - e.g.

```ts
const sellerContractInstance = await sellerLifecycle.newContractAPI.create({
  contract: swapContract,
  roles: { [scheme.ask.buyer.role_token]: mintRole("OpenRole") },
  accountDeposits: mkaccountDeposits([[scheme.offer.seller, seller.assetsProvisioned]]),
});
```

## @marlowe.io/marlowe-object

- **BREAKING CHANGE** Feat: Added Annotations to the contract type. ([PR-181](https://github.com/input-output-hk/marlowe-ts-sdk/pull/181))
- Experimental Feat: Added a sourceMap API to match the annotated marlowe-object source with the ContractClosure. ([PR-181](https://github.com/input-output-hk/marlowe-ts-sdk/pull/181))
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
