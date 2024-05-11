# Description

The `runtime-rest-client` package provides a JS API to interact with the [runtime REST API](https://docs.marlowe.iohk.io/api/introduction). It is intended to work with version `0.0.5` of the API.

The main {@link index | module} exposes the {@link index.mkRestClient} function, which returns an instance of a {@link index.RestClient}.

## Getting started

The `@marlowe.io/runtime-rest-client` package is [released as an ESM module](https://github.com/input-output-hk/marlowe-ts-sdk/blob/main/doc/modules-system.md) and can be used with a modern bundler or imported directly in the browser (without any bundler) as long as you use an import map.

### Browser

Instantiating a client requires a runtime URL to the desired network which can either be self hosted with instructions in [Marlowe starter kit](https://github.com/input-output-hk/marlowe-starter-kit/blob/main/docs/preliminaries.md) or through a service such as [Demeter](https://docs.demeter.run/extensions/marlowe-runtime).

The caller should run a `healthcheck` to ensure the runtime service is healthy throughout the lifecycle of the client.

```html
<html>
  <body>
    <script src="https://cdn.jsdelivr.net/gh/input-output-hk/marlowe-ts-sdk@0.4.0-beta/jsdelivr-npm-importmap.js"></script>
    <script type="module">
      import { mkRestClient } from "@marlowe.io/runtime-rest-client";

      let runtimeURL = process.env.MARLOWE_RUNTIME_URL;

      const client = mkRestClient(runtimeURL);
      const hasValidRuntime = await client.healthcheck();

      if (!hasValidRuntime) throw new Error("Invalid Marlowe Runtime instance");
    </script>
  </body>
</html>
```
