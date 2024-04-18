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
  depositTimeout: Timeout;
  disputeTimeout: Timeout;
  answerTimeout: Timeout;
  arbitrageTimeout: Timeout;
}
export function escrow({
  price,
  depositTimeout,
  disputeTimeout,
  answerTimeout,
  arbitrageTimeout,
}: EscrowParams): Contract {
  /* We can set explicitRefunds true to run Close refund analysis
   * but we get a shorter contract if we set it to false */
  const explicitRefunds: Boolean = false;

  const buyer: Party = Role("Buyer");
  const seller: Party = Role("Seller");
  const arbiter: Party = Role("Mediator");

  function choice(choiceName: string, chooser: Party, choiceValue: SomeNumber, continuation: Contract): Case {
    return Case(Choice(ChoiceId(choiceName, chooser), [Bound(choiceValue, choiceValue)]), continuation);
  }

  function deposit(timeout: Timeout, timeoutContinuation: Contract, continuation: Contract): Contract {
    return When([Case(Deposit(seller, buyer, ada, price), continuation)], timeout, timeoutContinuation);
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

  function paySeller(continuation: Contract): Contract {
    return Pay(buyer, Party(seller), ada, price, continuation);
  }

  const refundBuyer: Contract = explicitRefunds ? Pay(buyer, Party(buyer), ada, price, Close) : Close;

  const refundSeller: Contract = explicitRefunds ? Pay(seller, Party(seller), ada, price, Close) : Close;

  const contract: Contract = deposit(
    depositTimeout,
    Close,
    choices(disputeTimeout, buyer, refundSeller, [
      { value: 0n, name: "Everything is alright", continuation: refundSeller },
      {
        value: 1n,
        name: "Report problem",
        continuation: sellerToBuyer(
          choices(answerTimeout, seller, refundBuyer, [
            { value: 1n, name: "Confirm problem", continuation: refundBuyer },
            {
              value: 0n,
              name: "Dispute problem",
              continuation: choices(arbitrageTimeout, arbiter, refundBuyer, [
                {
                  value: 0n,
                  name: "Dismiss claim",
                  continuation: paySeller(Close),
                },
                {
                  value: 1n,
                  name: "Confirm problem",
                  continuation: refundBuyer,
                },
              ]),
            },
          ])
        ),
      },
    ])
  );

  return contract;
}
