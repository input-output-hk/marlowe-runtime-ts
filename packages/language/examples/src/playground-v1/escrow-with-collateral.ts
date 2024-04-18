// ____    __    ____  ___      .______      .__   __.  __  .__   __.   _______
// \   \  /  \  /   / /   \     |   _  \     |  \ |  | |  | |  \ |  |  /  _____|
//  \   \/    \/   / /  ^  \    |  |_)  |    |   \|  | |  | |   \|  | |  |  __
//   \            / /  /_\  \   |      /     |  . `  | |  | |  . `  | |  | |_ |
//    \    /\    / /  _____  \  |  |\  \----.|  |\   | |  | |  |\   | |  |__| |
//     \__/  \__/ /__/     \__\ | _| `._____||__| \__| |__| |__| \__|  \______|
// This file was produced by applying the `playground-compatibility.md` instructions
// to the example file downloaded from the PlayGround. If edited, make sure that all
// the examples in this folder have the same modification and that the guide is updated.

import {
  Address,
  Role,
  Account,
  Party,
  ada,
  AvailableMoney,
  Constant,
  NegValue,
  AddValue,
  SubValue,
  MulValue,
  DivValue,
  ChoiceValue,
  TimeIntervalStart,
  TimeIntervalEnd,
  UseValue,
  Cond,
  AndObs,
  OrObs,
  NotObs,
  ChoseSomething,
  ValueGE,
  ValueGT,
  ValueLT,
  ValueLE,
  ValueEQ,
  TrueObs,
  FalseObs,
  Deposit,
  Choice,
  Notify,
  Close,
  Pay,
  If,
  When,
  Let,
  Assert,
  SomeNumber,
  AccountId,
  ChoiceId,
  Token,
  ValueId,
  Value,
  EValue,
  Observation,
  Bound,
  Action,
  Payee,
  Case,
  Timeout,
  ETimeout,
  Contract,
} from "@marlowe.io/language-core-v1/playground-v1";

export interface EscrowParams {
  price: number;
  collateral: number;
  sellerCollateralTimeout: Timeout;
  buyerCollateralTimeout: Timeout;
  depositTimeout: Timeout;
  disputeTimeout: Timeout;
  answerTimeout: Timeout;
}

export function escrowWithCollateral({
  price,
  collateral,
  sellerCollateralTimeout,
  buyerCollateralTimeout,
  depositTimeout,
  disputeTimeout,
  answerTimeout,
}: EscrowParams): Contract {
  /* We can set explicitRefunds true to run Close refund analysis
   * but we get a shorter contract if we set it to false */
  const explicitRefunds: Boolean = false;

  const buyer: Party = Role("Buyer");
  const seller: Party = Role("Seller");
  const burnAddress: Party = Address("addr_test1vqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3lgle2");

  function depositCollateral(
    party: Party,
    timeout: Timeout,
    timeoutContinuation: Contract,
    continuation: Contract
  ): Contract {
    return When([Case(Deposit(party, party, ada, collateral), continuation)], timeout, timeoutContinuation);
  }

  function burnCollaterals(continuation: Contract): Contract {
    return Pay(
      seller,
      Party(burnAddress),
      ada,
      collateral,
      Pay(buyer, Party(burnAddress), ada, collateral, continuation)
    );
  }

  function deposit(timeout: Timeout, timeoutContinuation: Contract, continuation: Contract): Contract {
    return When([Case(Deposit(seller, buyer, ada, price), continuation)], timeout, timeoutContinuation);
  }

  function choice(choiceName: string, chooser: Party, choiceValue: SomeNumber, continuation: Contract): Case {
    return Case(Choice(ChoiceId(choiceName, chooser), [Bound(choiceValue, choiceValue)]), continuation);
  }

  function choices(
    timeout: Timeout,
    chooser: Party,
    timeoutContinuation: Contract,
    list: { value: SomeNumber; name: string; continuation: Contract }[]
  ): Contract {
    var caseList: Case[] = new Array(list.length);
    list.forEach(
      (element, index) => (caseList[index] = choice(element.name, chooser, element.value, element.continuation))
    );
    return When(caseList, timeout, timeoutContinuation);
  }

  function sellerToBuyer(continuation: Contract): Contract {
    return Pay(seller, Account(buyer), ada, price, continuation);
  }

  function refundSellerCollateral(continuation: Contract): Contract {
    if (explicitRefunds) {
      return Pay(seller, Party(seller), ada, collateral, continuation);
    } else {
      return continuation;
    }
  }

  function refundBuyerCollateral(continuation: Contract): Contract {
    if (explicitRefunds) {
      return Pay(buyer, Party(buyer), ada, collateral, continuation);
    } else {
      return continuation;
    }
  }

  function refundCollaterals(continuation: Contract): Contract {
    return refundSellerCollateral(refundBuyerCollateral(continuation));
  }

  const refundBuyer: Contract = explicitRefunds ? Pay(buyer, Party(buyer), ada, price, Close) : Close;

  const refundSeller: Contract = explicitRefunds ? Pay(seller, Party(seller), ada, price, Close) : Close;

  const contract: Contract = depositCollateral(
    seller,
    sellerCollateralTimeout,
    Close,
    depositCollateral(
      buyer,
      buyerCollateralTimeout,
      refundSellerCollateral(Close),
      deposit(
        depositTimeout,
        refundCollaterals(Close),
        choices(disputeTimeout, buyer, refundCollaterals(refundSeller), [
          {
            value: 0n,
            name: "Everything is alright",
            continuation: refundCollaterals(refundSeller),
          },
          {
            value: 1n,
            name: "Report problem",
            continuation: sellerToBuyer(
              choices(answerTimeout, seller, refundCollaterals(refundBuyer), [
                {
                  value: 1n,
                  name: "Confirm problem",
                  continuation: refundCollaterals(refundBuyer),
                },
                {
                  value: 0n,
                  name: "Dispute problem",
                  continuation: burnCollaterals(refundBuyer),
                },
              ])
            ),
          },
        ])
      )
    )
  );

  return contract;
}
