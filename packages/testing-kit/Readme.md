# Description

A Set of utilities to help with the test of the @marlowe.io packages.

## Test configuration

By default the test runner looks for a file './env/.test-env.json' in the current directory. An example configuration can look like this:

```json
{
  "bank": {
    "seedPhrase": "word1 ... word24"
  },
  "lucid": {
    "blockfrostProjectId": "preprodO8BxrgS8X8itWPQ0G97n53AkWjYAAYOi",
    "blockfrostUrl": "https://cardano-preprod.blockfrost.io/api/v0/blocks/latest"
  },
  "network": "Preprod",
  "runtimeURL": "https://localhost:3000"
}
```

Please provide some funding to the wallet address associated with the seed phrase. The seed phrase is used to generate the wallet which funds the test execution.

Type exact type for the format looks like this:

```typescript
type TestConfiguration = {
  bank: {
    seedPhrase: MnemonicString; // list of words (15, 18, 21, 24) separated by spaces
  };
  lucid: {
    blockfrostProjectId: string;
    blockfrostUrl: HttpUrl;
  };
  network: "Preprod" | "Testnet" | "Mainnet" | "Custom";
  runtimeURL: HttpUrl;
};
```

More information about the development can be found in the ./doc/howToDevelop.md file.
