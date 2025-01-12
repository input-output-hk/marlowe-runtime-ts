/** Create a {@link api.WalletAPI} from a Lucid wallet instance that can work both in the backend (Node.js/Deno) and in the browser ``` import { mkLucidWallet } from "@marlowe.io/wallet/lucid"; import { Lucid, Blockfrost } from "lucid-cardano";

    const lucid = await Lucid.new(
      new Blockfrost(config.blockfrostUrl, config.blockfrostProjectId),
      config.network
    );
    lucid.selectWalletFromSeed(config.seedPhrase);

    const wallet = mkLucidWallet(lucid);
  ```
 * @packageDocumentation
 */
import { C, Lucid, Unit, fromUnit, fromHex, toHex, Provider, Network, Utils, Wallet } from "lucid-cardano";

import { WalletAPI } from "../api.js";
import * as runtimeCore from "@marlowe.io/runtime-core";
import * as Codec from "@47ng/codec";
import { pipe } from "fp-ts/lib/function.js";
import * as A from "fp-ts/lib/Array.js";
import * as R from "fp-ts/lib/Record.js";
import { mergeAssets } from "@marlowe.io/adapter/lucid";
import { addressBech32, MarloweTxCBORHex, txOutRef } from "@marlowe.io/runtime-core";
import { mnemonicToEntropy } from 'bip39';

import * as CML from '@dcspark/cardano-multiplatform-lib-nodejs';
// let CML:any;
// if(typeof window !== 'undefined') {
//} else {
//  CML = await import('@dcspark/cardano-multiplatform-lib-browser');
//}

const getAssetName: (unit: Unit) => string = (unit) => {
  const assetName = fromUnit(unit).assetName;
  return assetName ? Codec.hexToUTF8(assetName) : "";
};

// NOTE: This function may report a different amount of lovelaces than
//       a CIP-30 wallet, as this can't take into account the collateral
//       UTxO.
const getTokens =
  (wallet: Wallet) =>
  async (): Promise<runtimeCore.Token[]> => {
    const utxos = await wallet.getUtxos();

    return pipe(
      utxos, // UTxO[]
      A.map((utxo) => utxo.assets), // LucidAssets[]
      A.reduce(mergeAssets.empty, mergeAssets.concat), // LucidAssets
      R.toEntries, // Array<[string, bigint]>
      A.map(([unit, quantity]) => {
        if (unit === "lovelace") {
          return runtimeCore.lovelaces(quantity);
        } else {
          return runtimeCore.token(quantity)(
            runtimeCore.assetId(runtimeCore.policyId(fromUnit(unit).policyId))(getAssetName(unit))
          );
        }
      })
    );
  };

const signTx =
  (wallet: Wallet) =>
  async (cborHex: MarloweTxCBORHex) => {
    const tx = C.Transaction.from_bytes(fromHex(cborHex));
    try {
      const txSigned = await wallet.signTx(tx);
      return toHex(txSigned.to_bytes());
    } catch (reason) {
      throw new Error(`Error while signing : ${reason}`);
    }
  };

const getLovelaces =
  (wallet: Wallet) =>
  async (): Promise<bigint> => {
    const tokens = await getTokens(wallet)();
    return pipe(
      tokens,
      A.filter((token) => runtimeCore.isLovelace(token.assetId)),
      A.reduce(0n, (acc, token) => acc + token.quantity)
    );
  };

const waitConfirmation =
  (provider: Provider) =>
  async (txHash: string) => {
    try {
      return await provider.awaitTx(txHash);
    } catch (reason) {
      throw new Error(`Error while awaiting : ${reason}`);
    }
  };


/**
 * Type level marker for the Lucid wallet which can be
 * dropped easily by `lucidWallet as WalletAPI`
 * It is useful when we want to restrict the wallet to this
 * specific type.
 */
export interface LucidBasedWallet extends WalletAPI {
  lucid: Lucid,
};

// Purpose derivation (See BIP43)
enum Purpose {
  CIP1852=1852, // see CIP 1852
}

// Cardano coin type (SLIP 44)
enum CoinTypes {
  CARDANO=1815,
}

enum ChainDerivation {
  EXTERNAL=0, // from BIP44
  INTERNAL=1, // from BIP44
  CHIMERIC=2, // from CIP1852
}

function mkSigningKey(mnemonic: string, accountIx: number=0, keyIx: number=0): CML.PrivateKey {
  const harden = (num: number): number => {
    return 0x80000000 + num;
  }
  const entropy = mnemonicToEntropy(mnemonic);
  const rootKey = CML.Bip32PrivateKey.from_bip39_entropy(
    Buffer.from(entropy, 'hex'),
    Buffer.from(''),
  );
  const account = rootKey.derive(harden(Purpose.CIP1852)).derive(harden(CoinTypes.CARDANO)).derive(harden(accountIx));
  const key = account.derive(ChainDerivation.EXTERNAL).derive(keyIx);
  return key.to_raw_key();
}

/**
 * @inheritdoc lucid
 */
export async function mkLucidBasedWallet(provider: Provider, network: Network, seedPhrase: string): Promise<LucidBasedWallet> {
  const lucid = await Lucid.new(provider, network);
  const signingKey = mkSigningKey(seedPhrase);
  lucid.selectWalletFromSeed(seedPhrase);
  return {
    lucid,

    waitConfirmation: waitConfirmation(provider),
    signTx: async (cborHex: MarloweTxCBORHex) => {
      const tx = CML.Transaction.from_cbor_hex(cborHex);
      const txHash = CML.hash_transaction(tx.body());
      const vkeyWitness = CML.make_vkey_witness(txHash, signingKey);
      const vkeyWitnessList = CML.VkeywitnessList.new()
      vkeyWitnessList.add(vkeyWitness);
      const transactionWitnessSet = CML.TransactionWitnessSet.new();
      transactionWitnessSet.set_vkeywitnesses(vkeyWitnessList);
      return transactionWitnessSet.to_cbor_hex();
    },
    getChangeAddress: () => lucid.wallet.address().then(addressBech32),
    getUsedAddresses: () => lucid.wallet.address().then((address) => [addressBech32(address)]),
    // NOTE: As far as I've seen Lucid doesn't support collateral UTxOs
    getCollaterals: () => Promise.resolve([]),
    getUTxOs: async () => {
      const utxos = await lucid.wallet.getUtxos();
      return utxos.map((utxo) => txOutRef(utxo.txHash));
    },
    isMainnet: async () => network == "Mainnet",
    getTokens: getTokens(lucid.wallet),
    getLovelaces: getLovelaces(lucid.wallet)
  };
}
