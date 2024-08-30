<h2 align="center">
  <a href="" target="blank_">
    <img src="./doc/image/logo.svg" alt="Logo" height="75">
  </a>
  <br>
  Lightweight and typesafe SDK for writing Marlowe Contracts
</h2>
  <p align="center">
    <a href="https://github.com/input-output-hk/marlowe-ts-sdk/releases"><img src="https://img.shields.io/github/v/release/input-output-hk/marlowe-ts-sdk?style=for-the-badge" /></a>
  </p>
<div align="center">
  <a href=""><img src="https://img.shields.io/badge/stability-beta-33bbff.svg" alt="Beta"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg"></a>
  <a href="https://discord.com/invite/cmveaxuzBn"><img src="https://img.shields.io/discord/826816523368005654?label=Chat%20on%20Discord"></a>
</div>

> [!IMPORTANT] 
> This Marlowe repository will soon be moved to https://github.com/marlowe-lang. The new repositories will be administered by an independent vehicle, a not-for-profit organization currently being set up by the transition team.<br> 
> This will allow us to ensure community representation and stewardship. Future developments and support for Marlowe are transitioning to a community-driven model initially led by [Simon Thompson](https://github.com/simonjohnthompson), [Nicolas Henin](https://github.com/nhenin) and [Tomasz Rybarczyk](https://github.com/paluh). <br>
> See [here](https://github.com/marlowe-lang/.github/blob/main/profile/transition.md) for details.



The **Marlowe TS-SDK** is a suite of _TypeScript/JavaScript_ libraries for developing Web-Dapp in the Cardano Blockchain using Marlowe Technologies.

It is composed of several npm packages documented in the [API reference](https://input-output-hk.github.io/marlowe-ts-sdk/) page.

## Runtime

In order to interact with Marlowe contracts, the **TS-SDK** needs a Runtime instance. The following table shows the compatibility between the SDK and the Runtime versions:

|                                                                                             | runtime v0.0.5 | runtime v0.0.6 | runtime v1.0.0 |
| ------------------------------------------------------------------------------------------- | :------------: | :------------: | :------------: |
| [SDK 0.2.0-beta](https://github.com/input-output-hk/marlowe-ts-sdk/releases/tag/0.2.0-beta) |       ✓        |       x        |       x        |
| [SDK 0.3.0-beta](https://github.com/input-output-hk/marlowe-ts-sdk/releases/tag/0.3.0-beta) |       ✓        |       ✓        |       x        |
| [SDK 0.4.0-beta](https://github.com/input-output-hk/marlowe-ts-sdk/releases/tag/0.4.0-beta) |       ✓        |       ✓        |       ✓        |

To get a running instance of the Runtime, it is recommended to check out the instructions on the [Marlowe Starter Kit](https://github.com/input-output-hk/marlowe-starter-kit)

## Wallets

### CIP-30 and Browser

The **TS-SDK** has a [CIP-30](https://github.com/cardano-foundation/CIPs/blob/master/CIP-0030/README.md) abstraction that works with
the following wallets:

| Wallets | Compatible | Not Compatible | Not Tested |
| ------- | :--------: | :------------: | :--------: |
| Nami    |     ✓      |                |            |
| Eternl  |     ✓      |                |            |
| Lace    |     ✓      |                |            |
| Yoroi   |            |                |     ?      |
| Typhon  |            |                |     ?      |

### Lucid and NodeJS

The **SDK** also provides a wrapper around the [Lucid](https://github.com/spacebudz/lucid) Library. This allows you to use the SDK in a NodeJS environment.

## Examples & Contract Use Cases

Inside the [examples folder](./examples/Readme.md) you can find a set of minimal examples on how to use different packages of the SDK.

Prototypes have been also built on top of this sdk:

- Payouts
  - [GitHub Repository](https://github.com/input-output-hk/marlowe-payouts)
  - [Deployed DApp](https://payouts-preprod.prod.scdev.aws.iohkdev.io/)
- Token Plans
  - [GitHub Repository](https://github.com/input-output-hk/marlowe-vesting)
  - Vesting Contract
    - [Implementation](https://github.com/input-output-hk/marlowe-ts-sdk/blob/main/packages/language/examples/src/vesting.ts)
    - [Documentation](https://input-output-hk.github.io/marlowe-ts-sdk/modules/_marlowe_io_language_examples.vesting.html)
  - [Deployed DApp](https://token-plans-preprod.prod.scdev.aws.iohkdev.io/)

## Community & Support

- Website : <a href="https://marlowe.iohk.io" > marlowe.iohk.io </a>
- Documentation :<a href="https://docs.marlowe.iohk.io" > docs.marlowe.iohk.io </a>
- Playground : <a href="https://play.marlowe.iohk.io" > play.marlowe.iohk.io </a>
- Blog : <a href="https://marlowe.iohk.io/blog" > marlowe.iohk.io/blog </a>
- Support : <a href="https://iohk.zendesk.com/hc/en-us/requests/new" > iohk.zendesk.com </a>

## Contributing

To report a bug or request a new feature, please look through existing [GitHub Issues](https://github.com/input-output-hk/marlowe-ts-sdk/issues) before opening a new one.

To help in the development of this SDK, please refer to [this document](./doc/howToDevelop.md).
