import * as API from "@blockfrost/blockfrost-js";
import {
  Blockfrost,
  Lucid,
  Network,
  C,
  PrivateKey,
  PolicyId,
  getAddressDetails,
  toUnit,
  fromText,
  NativeScript,
  Tx,
  TxSigned,
  TxComplete,
  Script,
  fromHex,
  toHex,
  fromUnit,
  Unit,
} from "lucid-cardano";
import * as A from "fp-ts/lib/Array.js";
import { pipe } from "fp-ts/lib/function.js";
import * as O from "fp-ts/lib/Option.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import * as T from "fp-ts/lib/Task.js";

import { unsafeTaskEither } from "@marlowe.io/adapter/fp-ts";
import {
  AddressBech32,
  TxOutRef,
  addressBech32,
  MarloweTxCBORHex,
  Token,
  lovelaces,
  token,
  assetId,
  policyId,
  AssetId,
} from "@marlowe.io/runtime-core";
import * as RuntimeCore from "@marlowe.io/runtime-core";
import { WalletAPI } from "../api.js";
import * as Codec from "@47ng/codec";
import { MarloweJSON } from "@marlowe.io/adapter/codec";
const log = (message: string) => console.log(`\t## - ${message}`);

// TODO: Make nominal
export type PrivateKeysAsHex = string;
export type Address = string;

// TODO: This is a pure datatype, convert to type alias or interface
export class Context {
  projectId: string;
  network: RuntimeCore.Network;
  blockfrostUrl: string;

  public constructor(
    projectId: string,
    blockfrostUrl: string,
    network: RuntimeCore.Network
  ) {
    this.projectId = projectId;
    this.network = network;
    this.blockfrostUrl = blockfrostUrl;
  }

  public toLucidNetwork(): Network {
    switch (this.network) {
      case "private":
        return "Custom";
      case "preview":
        return "Preview";
      case "preprod":
        return "Preprod";
      case "mainnet":
        return "Mainnet";
    }
  }
}

// [[testing-wallet-discussion]]
// DISCUSSION: Currently this class is more of a testing helper rather than being a NodeJS
//             implementation of the WalletAPI. It has extra methods for funding a wallet
//             and minting test tokens and it is missing some required methods like getUTxOs.
//
//             If we want to support a NodeJS implementation of the WalletAPI we should
//             probably remove the extra methods and find a way to share the Blockfrost
//             (or eventual underlying service) for testing.
//
//             It we don't want to support a NodeJS library for the moment, then this could
//             be moved to a @marlowe.io/runtime-xxx package, as it is not helping test the
//             wallet, but the runtime.
/**
 * @hidden
 */
export class SingleAddressWallet implements WalletAPI {
  private privateKeyBech32: string;
  private context: Context;
  private lucid: Lucid;
  private blockfrostApi: API.BlockFrostAPI;

  public address: AddressBech32;
  getChangeAddress: T.Task<AddressBech32>;
  getUsedAddresses: T.Task<AddressBech32[]>;
  getCollaterals: T.Task<TxOutRef[]>;

  private constructor(context: Context, privateKeyBech32: PrivateKey) {
    this.privateKeyBech32 = privateKeyBech32;
    this.context = context;
    this.blockfrostApi = new API.BlockFrostAPI({
      projectId: context.projectId,
    });
  }

  // TODO: Extract this to its own function
  static async Initialise(
    context: Context,
    privateKeyBech32: string
  ): Promise<SingleAddressWallet> {
    const account = new SingleAddressWallet(context, privateKeyBech32);
    await account.initialise();
    return account;
  }

  // TODO: Extract this to its own function
  static async Random(context: Context): Promise<SingleAddressWallet> {
    const privateKey = C.PrivateKey.generate_ed25519().to_bech32();
    const account = new SingleAddressWallet(context, privateKey);
    await account.initialise();
    return account;
  }

  private async initialise() {
    this.lucid = await Lucid.new(
      new Blockfrost(this.context.blockfrostUrl, this.context.projectId),
      this.context.toLucidNetwork()
    );
    this.lucid.selectWalletFromPrivateKey(this.privateKeyBech32);
    this.address = addressBech32(await this.lucid.wallet.address());
    this.getChangeAddress = T.of(this.address);
    this.getUsedAddresses = T.of([this.address]);
    this.getCollaterals = T.of([]);
  }

  async isMainnet() {
    return this.lucid.network === "Mainnet";
  }

  async getTokens(): Promise<Token[]> {
    try {
      const content = await this.blockfrostApi.addresses(this.address);
      return pipe(
        content.amount ?? [],
        A.map((tokenBlockfrost) =>
          tokenBlockfrost.unit === "lovelace"
            ? lovelaces(BigInt(tokenBlockfrost.quantity))
            : token(BigInt(tokenBlockfrost.quantity).valueOf())(
                assetId(policyId(fromUnit(tokenBlockfrost.unit).policyId))(
                  getAssetName(tokenBlockfrost.unit)
                )
              )
        )
      );
    } catch (reason) {
      throw new Error(`Error while retrieving assetBalance : ${reason}`);
    }
  }

  async getLovelaces(): Promise<bigint> {
    try {
      const content = await this.blockfrostApi.addresses(this.address);
      return pipe(
        content.amount ?? [],
        A.filter((amount) => amount.unit === "lovelaces"),
        A.map((amount) => BigInt(amount.quantity)),
        A.head,
        O.getOrElse(() => 0n)
      );
    } catch (reason) {
      throw new Error(`Error while retrieving assetBalance : ${reason}`);
    }
  }

  public tokenBalance: (assetId: AssetId) => TE.TaskEither<Error, bigint> = (
    assetId
  ) =>
    pipe(
      TE.tryCatch(
        () => this.blockfrostApi.addresses(this.address),
        (reason) => new Error(`Error while retrieving assetBalance : ${reason}`)
      ),
      TE.map((content) =>
        pipe(
          content.amount ?? [],
          A.filter(
            (amount) =>
              amount.unit ===
              toUnit(assetId.policyId, fromText(assetId.assetName))
          ),
          A.map((amount) => BigInt(amount.quantity)),
          A.head,
          O.getOrElse(() => 0n)
        )
      )
    );

  // see [[testing-wallet-discussion]]
  public provision: (
    provisionning: [SingleAddressWallet, bigint][]
  ) => TE.TaskEither<Error, Boolean> = (provisionning) =>
    pipe(
      provisionning,
      A.reduce(
        this.lucid.newTx(),
        (tx: Tx, account: [SingleAddressWallet, bigint]) =>
          tx.payToAddress(account[0].address, {
            lovelace: account[1],
          })
      ),
      build,
      TE.chain(this.signSubmitAndWaitConfirmation)
    );

  // see [[testing-wallet-discussion]]
  public async randomPolicyId(): Promise<[Script, PolicyId]> {
    const { paymentCredential } = this.lucid.utils.getAddressDetails(
      await this.lucid.wallet.address()
    );

    const json: NativeScript = {
      type: "all",
      scripts: [
        {
          type: "before",
          slot: this.lucid.utils.unixTimeToSlot(Date.now() + 1000000),
        },
        { type: "sig", keyHash: paymentCredential?.hash! },
      ],
    };
    const script = this.lucid.utils.nativeScriptFromJson(json);
    const policyId = this.lucid.utils.mintingPolicyToId(script);
    return [script, policyId];
  }

  // see [[testing-wallet-discussion]]
  public async mintRandomTokens(
    assetName: string,
    amount: bigint
  ): Promise<Token> {
    const policyRefs = await this.randomPolicyId();
    const [mintingPolicy, aPolicyId] = policyRefs;
    const assets = {
      [toUnit(aPolicyId, fromText(assetName))]: amount.valueOf(),
    };

    return unsafeTaskEither(
      pipe(
        this.lucid
          .newTx()
          .mintAssets(assets)
          .validTo(Date.now() + 100000)
          .attachMintingPolicy(mintingPolicy),
        build,
        TE.chain(this.signSubmitAndWaitConfirmation),
        TE.map(() => token(amount)(assetId(policyId(aPolicyId))(assetName)))
      )
    );
  }
  async signTx(cborHex: MarloweTxCBORHex) {
    const tx = C.Transaction.from_bytes(fromHex(cborHex));
    try {
      const txSigned = await this.lucid.wallet.signTx(tx);
      return toHex(txSigned.to_bytes());
    } catch (reason) {
      throw new Error(`Error while signing : ${reason}`);
    }
  }

  public sign: (txBuilt: TxComplete) => TE.TaskEither<Error, TxSigned> = (
    txBuilt
  ) =>
    TE.tryCatch(
      () => txBuilt.sign().complete(),
      (reason) => new Error(`Error while signing : ${reason}`)
    );

  public submit: (signedTx: TxSigned) => TE.TaskEither<Error, string> = (
    signedTx
  ) =>
    TE.tryCatch(
      () => signedTx.submit(),
      (reason) => new Error(`Error while submitting : ${reason}`)
    );

  waitConfirmation(txHash: string) {
    try {
      return this.lucid.awaitTx(txHash);
    } catch (reason) {
      throw new Error(`Error while awiting : ${reason}`);
    }
  }
  // see [[testing-wallet-discussion]]
  public signSubmitAndWaitConfirmation: (
    txBuilt: TxComplete
  ) => TE.TaskEither<Error, boolean> = (txBuilt) =>
    pipe(
      this.sign(txBuilt),
      TE.chain(this.submit),
      TE.chainFirst((txHash) => TE.of(log(`<> Tx ${txHash} submitted.`))),
      TE.chain((txHash) =>
        TE.tryCatch(
          () => this.waitConfirmation(txHash),
          (reason) =>
            new Error(`Error while retrieving assetBalance : ${reason}`)
        )
      )
    );
  // FIXME: Implement
  // see [[testing-wallet-discussion]]
  public getUTxOs: T.Task<TxOutRef[]> = T.of([]);
}

const build = (tx: Tx): TE.TaskEither<Error, TxComplete> =>
  TE.tryCatch(
    () => tx.complete(),
    (reason) => new Error(`Error while building Tx : ${reason}`)
  );

const getAssetName: (unit: Unit) => string = (unit) => {
  const assetName = fromUnit(unit).assetName;
  return assetName ? Codec.hexToUTF8(assetName) : "";
};

/**
 * Currently used for testing
 * see [[testing-wallet-discussion]]
 * @hidden
 */
export const getPrivateKeyFromHexString = (privateKeyHex: string): PrivateKey =>
  C.PrivateKey.from_bytes(Buffer.from(privateKeyHex, "hex")).to_bech32();
