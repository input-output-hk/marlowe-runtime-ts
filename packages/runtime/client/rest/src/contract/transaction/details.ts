import { optionFromNullable } from "io-ts-types";
import * as t from "io-ts/lib/index.js";
import * as O from "fp-ts/lib/Option.js";

import { ISO8601 } from "@marlowe.io/adapter/time";
import * as G from "@marlowe.io/language-core-v1/guards";
import { BuiltinByteString, Contract, Input, MarloweState } from "@marlowe.io/language-core-v1";
import {
  TagsGuard,
  MetadataGuard,
  Metadata,
  BlockHeaderGuard,
  TxOutRef,
  TxId,
  TextEnvelopeGuard,
  ContractId,
  Tags,
  BlockHeader,
  ContractIdGuard,
  TextEnvelope,
  TxIdGuard,
} from "@marlowe.io/runtime-core";
import { TxStatus } from "./status.js";
import { assertGuardEqual, proxy } from "@marlowe.io/adapter/io-ts";

/**
 * Represents the response of the {@link index.RestClient#getContractTransactionById | Get contract transaction by ID } endpoint
 *
 * @experimental
 * This type is experimental and subject to change. See current DISCUSSIONS in the source code.
 */
export interface TransactionDetails {
  /**
   * Identifies the Marlowe contract this transaction belongs to.
   */
  contractId: ContractId;
  /**
   * Identifies the applyInput transaction within the contract.
   */
  transactionId: TxId;
  /**
   * Optional continuation of the contract.
   */
  continuations: O.Option<BuiltinByteString>;
  /**
   * Optional tags associated with the transaction.
   */
  tags: Tags;
  /**
   * Optional metadata associated with the transaction.
   */
  metadata: Metadata;
  /**
   * The status of the applyInput transaction.
   */
  status: TxStatus;
  /**
   * Optional block information to search for the transaction in the blockchain.
   */
  // DISCUSSION: @Jamie, @N.H. The optional part is because this is only present if the transaction is confirmed?
  //             If so, we should maybe include the Block Header as part of the confirmed constructor to avoid
  //             impossible states?
  block: O.Option<BlockHeader>;
  /**
   * The UTXO that was used as input for the transaction.
   */
  inputUtxo: TxOutRef;
  /**
   * The list of Marlowe inputs that were applied in this transaction
   */
  inputs: Input[];
  // DISCUSSION: @Jamie, @N.H. Similar discussion as the block one. Are these Options part of a confirmed
  //            transaction?
  //            Looking for this contractid and txid it has None for these fields in preprod
  //            contractID "19a90f8db56fab54d5e4fc4a4c0fd5084bb280a07841f2182b22305962285ad1#1",
  //            txId "b733caef6a21526b98586112d2090d0e1373654bf17ad85240fb12f08fb58802"
  outputUtxo: O.Option<TxOutRef>;
  outputContract: O.Option<Contract>;
  outputState: O.Option<MarloweState>;
  // QUESTION: @Jamie, @N.H, what is this?
  consumingTx: O.Option<TxId>;
  // DISCUSSION: @Jamie, @N.H. Should this be a TimeInterval instead?
  invalidBefore: ISO8601;
  invalidHereafter: ISO8601;
  // QUESTION: @Jamie, what is this? The signed txbody?
  txBody: O.Option<TextEnvelope>;
}

/**
 * @hidden
 */
export const TransactionDetailsGuard = assertGuardEqual(
  proxy<TransactionDetails>(),
  t.type({
    contractId: ContractIdGuard,
    transactionId: TxIdGuard,
    continuations: optionFromNullable(G.BuiltinByteString),
    tags: TagsGuard,
    metadata: MetadataGuard,
    status: TxStatus,
    block: optionFromNullable(BlockHeaderGuard),
    inputUtxo: TxOutRef,
    inputs: t.array(G.Input),
    outputUtxo: optionFromNullable(TxOutRef),
    outputContract: optionFromNullable(G.Contract),
    outputState: optionFromNullable(G.MarloweState),
    consumingTx: optionFromNullable(TxIdGuard),
    invalidBefore: ISO8601,
    invalidHereafter: ISO8601,
    txBody: optionFromNullable(TextEnvelopeGuard),
  })
);
