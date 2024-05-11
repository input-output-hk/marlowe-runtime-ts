# Description

This package contains code to work with the version 1 of Marlowe Core. It exports 5 modules:

- @{@link index | marlowe.io/language-core-v1} - Exports static types (TypeScript only) for the JSON schema as specified in the Appendix E of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe specification}
- @{@link guards | marlowe.io/language-core-v1/guards} - Exports {@link !io-ts-usage | Dynamic type guards} (both JavaScript and TypeScript) for the same schema. These are used to validate the JSON objects at runtime.
- @{@link playground-v1 | marlowe.io/language-core-v1/playground-v1} - Exports constructors compatible with the Playground's `marlowe-js` internal library.
- @{@link semantics | marlowe.io/language-core-v1/semantics} - Exports the semantics of the Core language as specified in the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe specification}. This can be used to simulate or unit test a contract.

## Getting started

This package is [released as an ESM module](https://github.com/input-output-hk/marlowe-ts-sdk/blob/main/doc/modules-system.md) and can be used with a modern bundler or imported directly in the browser (without any bundler) as long as you use an import map.

### Browser

```html
<html>
  <body>
    <script src="https://cdn.jsdelivr.net/gh/input-output-hk/marlowe-ts-sdk@0.4.0-beta/jsdelivr-npm-importmap.js"></script>
    <script type="module">
      import { Contract } from "@marlowe.io/language-core-v1/guards";
      const jsonObject = JSON.parse(httpResponse);

      if (Contract.is(jsonObject)) {
        // The jsonObject respects the JSON schema for Contract
      } else {
        // The jsonObject does not respect the JSON schema for Contract
      }
    </script>
  </body>
</html>
```
