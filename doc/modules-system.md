# Modules System

Javascript didn't have an official module support until ESM was introduced in 2015, in 2020 all the major browsers implemented it. By 2023, the community is still in the process of migrating from CommonJS, UMD, etc to ESM, and different tools and libraries have varying support for it.

## ESM

The Marlowe SDK is built using ESM modules but one of its dependencies (fp-ts) doesn't [correctly implement it](https://github.com/gcanti/fp-ts/issues/1777) in its current version. For that reason, we use [rollup](https://rollupjs.org/) to generate a ESM bundle that includes fp-ts. To ease development, we also generate [import maps](https://github.com/WICG/import-maps#import-maps) that tell the browser where to find the different modules.

In most packages documentation you'll find something like:

```html
<script src="https://cdn.jsdelivr.net/gh/input-output-hk/marlowe-ts-sdk@0.4.0-beta/jsdelivr-npm-importmap.js"></script>
<script type="module">
  import * as wallet from "@marlowe.io/wallet";
  // ...
</script>
```

If you are using a bundler you don't need the import map as each `package.json`` correctly points to a module using the [exports property](https://webpack.js.org/guides/package-exports/).

> NOTE: Because of how `fp-ts` is bundled, it is included (and tree-shaked) in all the SDK bundled packages, so using your own bundling step can help you reduce the size of the downloaded code.

## CommonJS

> NOTE: [[CommonJS exports problem]]

This repository configures how to be imported using `ESM` and `CJS` modules, but the latter is currently not working because one of the dependencies [does not support CJS](https://github.com/spacebudz/lucid#compatibility). We need to re-assess if we can use an alternative that does support CJS so that it is easier to import the SDK from older setups.
