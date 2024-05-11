# Development

# Build

In order to start develop the SDK you need to install the dependencies and build the packages.

```bash
$ npm i
$ npm run build
```

If you want to build a single package you can use the `-w` flag or execute the build command from the package folder.

```bash
# From the root folder
$ npm run build -w @marlowe.io/language-core-v1
# Or you can enter the package and build
$ cd packages/language/core/v1
$ npm run build
```

# Clean

In order to clean the build artifacts you can use the `clean` command.

```bash
$ npm run clean
```

# Tests

N.B : It is recommended to clean and build the packages before you run the tests to be sure you are playing with the most up to date version of the codebase.

```bash
$ npm run clean && npm run build
```

## Unit Tests

To run the unit tests for all the packages, from the root folder you can execute the `test` command :

```bash
$ npm test
```

If you want to run tests for a single package you can use the `-w` flag or execute the build command from the package folder.

```bash
# From the root folder
$ npm run clean && npm run build && npm test -w @marlowe.io/language-core-v1
# Or you can enter the package folder and test. You will have to clean and build properly the local package
# dependencies of this current package if you modify one of them
# e.g : `packages/language/core/v1` depends on `packages/adapter`. Be sure you have build correctly this package before runnning your test that way.
$ cd packages/language/core/v1
$ npm test
```

## Integration/E2E Tests

### Setting up the env Configuration File

1. Create a `./env/.test-env.json` at the root of the project
2. Copy/Paste the following, and provide the necessary parameter

```json
{
  "bank": {
    "seedPhrase": "<seed phrase separated by spaces>"
  },
  "lucid": {
    "blockfrostProjectId": "<your-blockfrost-project-id>",
    "blockfrostUrl": "<your-blockfrost-url>"
  },
  "network": "Preprod",
  "runtimeURL": "http://<path-to-a-runtime-instance>:<a-port>"
}
```

#### How to Generate a new Seed Phrase for a Bank Wallet ?

1. At the root of the project :

```bash
npm run -w @marlowe.io/testing-kit genSeedPhrase
```

2. Copy/paste the words within quotes in the env file.
3. Go to one of your favorite Wallet Extension and restore a wallet with this seedphrase
4. Get a Payment Address from these Browser extensions to provision your Bank with the faucet.

#### How to add tAda to the Bank Wallet via a faucet ?

1. Retrieve your Bank Wallet payment address
2. Go to https://docs.cardano.org/cardano-testnet/tools/faucet ask for test Ada on this address.
3. Wait a moment till the transaction is confirmed and you should be able to run the tests.

### Running the E2E Tests

To run the e2e tests for all the packages, from the root folder you can execute the `test:e2e` command :

```bash
$ npm run test:e2e
```

If you want to run tests for a single package you can use the `-w` flag or execute the build command from the package folder.

```bash
# From the root folder
$ npm run clean && npm run build && npm run test:e2e -w @marlowe.io/runtime-lifecycle
# Or you can enter the package folder and test. You will have to clean and build properly the local package
# dependencies of this current package if you modify one of them
$ cd packages/runtime/client/rest
$ npm run test:e2e
```

## Documentation

> ⚠ You need to [build the packages](#build) before you can compile the documentation!

If this is your first time serving the docs, you will need to build the theme first.

```bash
$ cd doc/theme
$ npm run build
$ cd ../../
```

To compile all documentation

```bash
$ npm run docs
```

Serve the documentation.

```bash
$ npm run serve
```

You should now be able to view the docs locally at `localhost:1337`.

Documentation is built with [TypeDoc](https://typedoc.org), published through [GitHub Pages](https://pages.github.com), and hosted at https://input-output-hk.github.io/marlowe-ts-sdk

Each sub project needs a `typedoc.json` file in the sub project root directory as specified in the `workspaces` field in `./packages.json`. For example, there's some project "some-project" specified:

```json
// ./packages.json
{
  ...,
  "workspaces": ["./path/to/some-project"]
}
```

There needs to be a `typedoc.json` in `./path/to/some-project` and it needs properties along the lines of this example:

```json
// ./path/to/some-project/typedoc.json
{
  "entryPointStrategy": "expand",
  "entryPoints": ["./src"],
  "tsconfig": "./tsconfig.json"
}
```

### Changelogs

This project manages its changelog with [scriv](https://github.com/nedbat/scriv). PRs are automatically checked to see if there's a new entry in the `./changelog.d` folder. If a PR doesn't need a changelog entry, a `No Changelog Required` label can be added to disable the check.

Create a new changelog entry template with

```bash
$ scriv create
```

edit the new file with appropriate content for your PR and commit it. Read [the documentation for scriv](https://scriv.readthedocs.io/en) to learn more about how to use this tool.

To collect all changelog entries into a single file, execute `std` from the nix shell and run the `build-changelog` script. This command will delete all entries from the `changelog.d` folder and update the `CHANGELOG.md` file.

## Publish

For the moment the SDK is manually published to npm. Task PLT-6939 captures the work to automate this process through the CI.

Before publishing it's convenient to verify that the artifacts works as expected :

- Clean & Build

```bash
$ npm run clean && npm run build
```

- Test

```bash
$ npm t && npm run test:e2e
```

- Check the packages
  To test this you can pack all the different packages into tarballs using

```bash
$ npm --workspaces pack --pack-destination dist
```

And in a separate project you can install the tarballs using a file url when declaring the dependency

```json
{
  "dependencies": {
    "@marlowe.io/runtime-lifecycle": "file:<path-to-dist>/marlowe.io-runtime-lifecycle-0.4.0-beta.tgz",
    "@marlowe.io/runtime-rest-client": "file:<path-to-dist>/marlowe.io-runtime-rest-client-0.4.0-beta.tgz",
    "@marlowe.io/adapter": "file:<path-to-dist>/marlowe.io-adapter-0.4.0-beta.tgz",
    "@marlowe.io/runtime-core": "file:<path-to-dist>/marlowe.io-runtime-core-0.4.0-beta.tgz",
    "@marlowe.io/language-core-v1": "file:<path-to-dist>/marlowe.io-language-core-v1-0.4.0-beta.tgz",
    "@marlowe.io/language-examples": "file:<path-to-dist>/marlowe.io-language-examples-0.4.0-beta.tgz",
    "@marlowe.io/wallet": "file:<path-to-dist>/marlowe.io-wallet-0.4.0-beta.tgz"
  }
}
```

TODO [[Publish pre-check]] Local map and this pack instructions
TODO instructions on how to manually publish
In order to check that the export/import mechanism works on the browser using import maps you can:

1. Create a testing branch in a fork of the repo
1. Clean and build the project `npm run clean && npm run build`
1. Remove `dist` from `.gitignore`
1. Commit the `dist` folders of the different packages
1. Get the full git hash of the commit using `git rev-parse HEAD`
1. Publish the branch in your fork
1. Modify `rollup/config.mjs` and set the correct `owner` and `version` when we build the import map for jsdelivr-gh.
1. Rebuild the project `npm run build`
1. Modify the html in the `pocs` folder to use `/dist/jsdelivr-gh-importmap.js`
1. From the root folder run `npx http-server --port 1337 -c-1  -o ./`
1. Verify that each poc example works properly.
