import { AtomicSwap } from "@marlowe.io/language-examples";
import * as G from "@marlowe.io/language-core-v1/guards";
import { expectType } from "@marlowe.io/adapter/io-ts";

import { datetoTimeout, close, Party, Payee, Input } from "@marlowe.io/language-core-v1";
import { TransactionSuccess, emptyState, playTrace } from "@marlowe.io/language-core-v1/semantics";
import {
  ConfirmSwap,
  ProvisionOffer,
  Retract,
  Swap,
  getActiveState,
  getApplicableActions,
  getClosedState,
  waitingForAnswer,
  waitingForSwapConfirmation,
  waitingSellerOffer,
} from "../src/atomicSwap.js";
import * as t from "io-ts/lib/index.js";

const aDeadlineInThePast = datetoTimeout(new Date("2000-05-01"));
const contractStart = datetoTimeout(new Date("2000-05-02"));
const aGivenNow = datetoTimeout(new Date("2000-05-04"));
const aTxInterval = {
  from: datetoTimeout(new Date("2000-05-03")),
  to: datetoTimeout(new Date("2000-05-05")),
};
const aDeadlineInTheFuture = datetoTimeout(new Date("2000-05-06"));
const aGivenNowAfterDeadline = datetoTimeout(new Date("2000-05-07"));

const anAsset = {
  amount: 1n,
  token: { currency_symbol: "aCurrency", token_name: "sellerToken" },
};
const anotherAsset = {
  amount: 2n,
  token: { currency_symbol: "aCurrency", token_name: "buyerToken" },
};

describe("Atomic Swap", () => {
  describe("is active (on 4 different states)", () => {
    it("when waiting a seller offer - WaitingSellerOffer", () => {
      // Set up
      const scheme: AtomicSwap.Scheme = {
        offer: {
          seller: { address: "sellerAddress" },
          deadline: aDeadlineInTheFuture,
          asset: anAsset,
        },
        ask: {
          buyer: { role_token: "buyer" },
          deadline: aDeadlineInTheFuture,
          asset: anotherAsset,
        },
        swapConfirmation: {
          deadline: aDeadlineInTheFuture,
        },
      };
      const inputFlow: Input[] = [];

      // Execute

      const contract = AtomicSwap.mkContract(scheme);
      const state = emptyState(aDeadlineInThePast);

      // Verify

      const activeState = getActiveState(
        scheme,
        aGivenNow,
        inputFlow.map((input) => ({ interval: aTxInterval, input: input })),
        state
      );
      expect(activeState.type).toBe("WaitingSellerOffer");
    });
    it("when no seller offer have been provided in time - NoSellerOfferInTime", () => {
      // Set up
      const scheme: AtomicSwap.Scheme = {
        offer: {
          seller: { address: "sellerAddress" },
          deadline: aDeadlineInTheFuture,
          asset: anAsset,
        },
        ask: {
          buyer: { role_token: "buyer" },
          deadline: aDeadlineInTheFuture,
          asset: anotherAsset,
        },
        swapConfirmation: {
          deadline: aDeadlineInTheFuture,
        },
      };
      const inputFlow: Input[] = [];

      // Execute

      const contract = AtomicSwap.mkContract(scheme);
      const state = emptyState(aDeadlineInThePast);

      // Verify

      const activeState = getActiveState(
        scheme,
        aGivenNowAfterDeadline,
        inputFlow.map((input) => ({ interval: aTxInterval, input: input })),
        state
      );
      expect(activeState.type).toBe("NoSellerOfferInTime");
    });
    it("when waiting a for an answer - WaitingForAnswer", () => {
      // Set up
      const scheme: AtomicSwap.Scheme = {
        offer: {
          seller: { address: "sellerAddress" },
          deadline: aDeadlineInTheFuture,
          asset: anAsset,
        },
        ask: {
          buyer: { role_token: "buyer" },
          deadline: aDeadlineInTheFuture,
          asset: anotherAsset,
        },
        swapConfirmation: {
          deadline: aDeadlineInTheFuture,
        },
      };
      const inputFlow: Input[] = [(getApplicableActions(scheme, waitingSellerOffer)[0] as ProvisionOffer).input];

      // Execute

      const { contract, state, payments, warnings } = expectType(
        G.TransactionSuccess,
        playTrace(contractStart, AtomicSwap.mkContract(scheme), [
          {
            tx_interval: aTxInterval,
            tx_inputs: inputFlow,
          },
        ])
      );

      // Verify

      expect(warnings).toStrictEqual([]);
      expect(contract).not.toBe(close);
      expect(payments).toStrictEqual([]);

      const activeState = getActiveState(
        scheme,
        aGivenNow,
        inputFlow.map((input) => ({ interval: aTxInterval, input: input })),
        state
      );
      expect(activeState.type).toBe("WaitingForAnswer");
    });
    it("when waiting a for a swap confirmation (Open Role requirement to prevent double-satisfaction attacks) - WaitingForSwapConfirmation", () => {
      // Set up
      const scheme: AtomicSwap.Scheme = {
        offer: {
          seller: { address: "sellerAddress" },
          deadline: aDeadlineInTheFuture,
          asset: anAsset,
        },
        ask: {
          buyer: { role_token: "buyer" },
          deadline: aDeadlineInTheFuture,
          asset: anotherAsset,
        },
        swapConfirmation: {
          deadline: aDeadlineInTheFuture,
        },
      };
      const inputFlow: Input[] = [
        (getApplicableActions(scheme, waitingSellerOffer)[0] as ProvisionOffer).input,
        (getApplicableActions(scheme, waitingForAnswer)[0] as Swap).input,
      ];

      // Execute

      const { contract, state, payments, warnings } = expectType(
        G.TransactionSuccess,
        playTrace(contractStart, AtomicSwap.mkContract(scheme), [
          {
            tx_interval: aTxInterval,
            tx_inputs: inputFlow,
          },
        ])
      );

      // Verify
      const expectedPayments = [
        {
          payment_from: scheme.offer.seller,
          to: payeeAccount(scheme.ask.buyer),
          amount: scheme.offer.asset.amount,
          token: scheme.offer.asset.token,
        },
        {
          payment_from: scheme.ask.buyer,
          to: payeeAccount(scheme.offer.seller),
          amount: scheme.ask.asset.amount,
          token: scheme.ask.asset.token,
        },
      ];
      expect(warnings).toStrictEqual([]);
      expect(contract).not.toBe(close);
      expect(payments).toStrictEqual(expectedPayments);

      const activeState = getActiveState(
        scheme,
        aGivenNow,
        inputFlow.map((input) => ({ interval: aTxInterval, input: input })),
        state
      );
      expect(activeState.type).toBe("WaitingForSwapConfirmation");
    });
  });
  describe("is closed (with 5 closed reasons)", () => {
    it("when tokens have been swapped - Swapped", () => {
      // Set up
      const scheme: AtomicSwap.Scheme = {
        offer: {
          seller: { address: "sellerAddress" },
          deadline: aDeadlineInTheFuture,
          asset: anAsset,
        },
        ask: {
          buyer: { role_token: "buyer" },
          deadline: aDeadlineInTheFuture,
          asset: anotherAsset,
        },
        swapConfirmation: {
          deadline: aDeadlineInTheFuture,
        },
      };
      const inputFlow = [
        (getApplicableActions(scheme, waitingSellerOffer)[0] as ProvisionOffer).input,
        (getApplicableActions(scheme, waitingForAnswer)[0] as Swap).input,
        (getApplicableActions(scheme, waitingForSwapConfirmation)[0] as ConfirmSwap).input,
      ];

      // Execute

      const { contract, payments, warnings } = expectType(
        G.TransactionSuccess,
        playTrace(contractStart, AtomicSwap.mkContract(scheme), [
          {
            tx_interval: aTxInterval,
            tx_inputs: inputFlow,
          },
        ])
      );

      // Verify

      const expectedPayments = [
        {
          payment_from: scheme.offer.seller,
          to: payeeAccount(scheme.ask.buyer),
          amount: scheme.offer.asset.amount,
          token: scheme.offer.asset.token,
        },
        {
          payment_from: scheme.ask.buyer,
          to: payeeAccount(scheme.offer.seller),
          amount: scheme.ask.asset.amount,
          token: scheme.ask.asset.token,
        },
        {
          payment_from: scheme.offer.seller,
          to: payeeParty(scheme.offer.seller),
          amount: scheme.ask.asset.amount,
          token: scheme.ask.asset.token,
        },
        {
          payment_from: scheme.ask.buyer,
          to: payeeParty(scheme.ask.buyer),
          amount: scheme.offer.asset.amount,
          token: scheme.offer.asset.token,
        },
      ];
      expect(warnings).toStrictEqual([]);
      expect(contract).toBe(close);
      expect(payments).toStrictEqual(expectedPayments);

      const state = getClosedState(
        scheme,
        inputFlow.map((input) => ({ interval: aTxInterval, input: input }))
      );
      expect(state.reason.type).toBe("Swapped");
    });
    it("when tokens have been swapped but nobody has confirmed the swap on time (Open Role requirement to prevent double-satisfaction attacks) - SwappedButNotNotifiedOnTime", () => {
      // Set up
      const scheme: AtomicSwap.Scheme = {
        offer: {
          seller: { address: "sellerAddress" },
          deadline: aDeadlineInTheFuture,
          asset: anAsset,
        },
        ask: {
          buyer: { role_token: "buyer" },
          deadline: aDeadlineInTheFuture,
          asset: anotherAsset,
        },
        swapConfirmation: {
          deadline: aDeadlineInThePast,
        },
      };
      const inputFlow = [
        (getApplicableActions(scheme, waitingSellerOffer)[0] as ProvisionOffer).input,
        (getApplicableActions(scheme, waitingForAnswer)[0] as Swap).input,
      ];

      // Execute

      const { contract, payments, warnings } = expectType(
        G.TransactionSuccess,
        playTrace(contractStart, AtomicSwap.mkContract(scheme), [
          {
            tx_interval: aTxInterval,
            tx_inputs: inputFlow,
          },
        ])
      );

      // Verify

      const expectedPayments = [
        {
          payment_from: scheme.offer.seller,
          to: payeeAccount(scheme.ask.buyer),
          amount: scheme.offer.asset.amount,
          token: scheme.offer.asset.token,
        },
        {
          payment_from: scheme.ask.buyer,
          to: payeeAccount(scheme.offer.seller),
          amount: scheme.ask.asset.amount,
          token: scheme.ask.asset.token,
        },
        {
          payment_from: scheme.offer.seller,
          to: payeeParty(scheme.offer.seller),
          amount: scheme.ask.asset.amount,
          token: scheme.ask.asset.token,
        },
        {
          payment_from: scheme.ask.buyer,
          to: payeeParty(scheme.ask.buyer),
          amount: scheme.offer.asset.amount,
          token: scheme.offer.asset.token,
        },
      ];

      expect(warnings).toStrictEqual([]);
      expect(contract).toBe(close);
      expect(payments).toStrictEqual(expectedPayments);

      const state = getClosedState(
        scheme,
        inputFlow.map((input) => ({ interval: aTxInterval, input: input }))
      );
      expect(state.reason.type).toBe("SwappedButNotNotifiedOnTime");
    });
    it("when no buyer has answered to the offer on time - NotAnsweredOnTime", () => {
      // Set up
      const scheme: AtomicSwap.Scheme = {
        offer: {
          seller: { address: "sellerAddress" },
          deadline: aDeadlineInTheFuture,
          asset: anAsset,
        },
        ask: {
          buyer: { role_token: "buyer" },
          deadline: aDeadlineInThePast,
          asset: anotherAsset,
        },
        swapConfirmation: {
          deadline: aDeadlineInTheFuture,
        },
      };
      const inputFlow = [(getApplicableActions(scheme, waitingSellerOffer)[0] as ProvisionOffer).input];

      // Execute

      const { contract, payments, warnings } = expectType(
        G.TransactionSuccess,
        playTrace(contractStart, AtomicSwap.mkContract(scheme), [
          {
            tx_interval: aTxInterval,
            tx_inputs: inputFlow,
          },
        ])
      );

      // Verify

      const expectedPayments = [
        {
          payment_from: scheme.offer.seller,
          to: payeeParty(scheme.offer.seller),
          amount: scheme.offer.asset.amount,
          token: scheme.offer.asset.token,
        },
      ];
      expect(warnings).toStrictEqual([]);
      expect(contract).toBe(close);
      expect(payments).toStrictEqual(expectedPayments);

      const state = getClosedState(
        scheme,
        inputFlow.map((input) => ({ interval: aTxInterval, input: input }))
      );
      expect(state.reason.type).toBe("NotAnsweredOnTime");
    });
    it("when the seller has retracted - SellerRetracted", () => {
      // Set up
      const scheme: AtomicSwap.Scheme = {
        offer: {
          seller: { address: "sellerAddress" },
          deadline: aDeadlineInTheFuture,
          asset: anAsset,
        },
        ask: {
          buyer: { role_token: "buyer" },
          deadline: aDeadlineInTheFuture,
          asset: anotherAsset,
        },
        swapConfirmation: {
          deadline: aDeadlineInTheFuture,
        },
      };
      const inputFlow = [
        (getApplicableActions(scheme, waitingSellerOffer)[0] as ProvisionOffer).input,
        (getApplicableActions(scheme, waitingForAnswer)[1] as Retract).input,
      ];

      // Execute

      const { contract, payments, warnings } = expectType(
        G.TransactionSuccess,
        playTrace(contractStart, AtomicSwap.mkContract(scheme), [
          {
            tx_interval: aTxInterval,
            tx_inputs: inputFlow,
          },
        ])
      );

      // Verify

      const expectedPayments = [
        {
          payment_from: scheme.offer.seller,
          to: payeeParty(scheme.offer.seller),
          amount: scheme.offer.asset.amount,
          token: scheme.offer.asset.token,
        },
      ];
      expect(warnings).toStrictEqual([]);
      expect(contract).toBe(close);
      expect(payments).toStrictEqual(expectedPayments);

      const state = getClosedState(
        scheme,
        inputFlow.map((input) => ({ interval: aTxInterval, input: input }))
      );
      expect(state.reason.type).toBe("SellerRetracted");
    });
    it("when the seller has not provisioned the contract on time and advance is applied - NoOfferProvisionnedOnTime", () => {
      // Set up
      const scheme: AtomicSwap.Scheme = {
        offer: {
          seller: { address: "sellerAddress" },
          deadline: aDeadlineInThePast,
          asset: anAsset,
        },
        ask: {
          buyer: { role_token: "buyer" },
          deadline: aDeadlineInTheFuture,
          asset: anotherAsset,
        },
        swapConfirmation: {
          deadline: aDeadlineInTheFuture,
        },
      };
      const advance: Input[] = [];

      // Execute

      const { contract, payments, warnings } = expectType(
        G.TransactionSuccess,
        playTrace(contractStart, AtomicSwap.mkContract(scheme), [
          {
            tx_interval: aTxInterval,
            tx_inputs: advance,
          },
        ])
      );

      // Verify

      expect(warnings).toStrictEqual([]);
      expect(contract).toBe(close);
      expect(payments).toStrictEqual([]);

      const state = getClosedState(
        scheme,
        advance.map((input) => ({ interval: aTxInterval, input: input }))
      );
      expect(state.reason.type).toBe("NoOfferProvisionnedOnTime");
    });
  });
});

const payeeAccount = (party: Party): Payee => ({ account: party });
const payeeParty = (party: Party): Payee => ({ party: party });
