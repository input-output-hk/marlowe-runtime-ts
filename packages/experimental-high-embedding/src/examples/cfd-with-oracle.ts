import {
  Action,
  Bound,
  Chain,
  ChoiceAction,
  Close,
  Constant,
  Div,
  Do,
  If,
  Let,
  Min,
  Mul,
  Party,
  Role,
  SetContingency,
  Sub,
  Value,
  lovelace,
  waitFor,
  waitUntil,
} from "../index.js";

interface TimeWindow {
  beginning: Date;
  deadline: Date;
}

interface Bidder {
  party: Party;
  deposit: Value;
}
interface CFD {
  partyBidder: Bidder;
  counterparty: Bidder;
  oracle: Party;
  depositDeadline: Date;
  priceBeginning: Value;
  firstWindow: TimeWindow;
  secondWindow: TimeWindow;
  exchangeBegining: ChoiceAction;
  exchangeEnd: ChoiceAction;
}

type SplitResult = "Decrease in price" | "Increase in price";

function cfd(opts: CFD) {
  let {
    partyBidder,
    counterparty,
    depositDeadline,
    priceBeginning,
    firstWindow,
    secondWindow,
    exchangeBegining,
    exchangeEnd,
  } = opts;

  const oracleChooses = (choice: Action, deadline: Date) =>
    waitFor(choice).after(deadline, Close);

  const fullRefund = Do(
    partyBidder.party
      .payOut(partyBidder.deposit, lovelace)
      .to(partyBidder.party),
    counterparty.party
      .payOut(counterparty.deposit, lovelace)
      .to(counterparty.party),
    Close
  );

  let splitDifference = (
    splitResult: SplitResult,
    bigger: Value,
    lower: Value
  ) =>
    Let(splitResult, Sub(bigger, lower)).in((deltaPrice) => {
      const winner =
        splitResult == "Decrease in price" ? partyBidder : counterparty;
      const looser =
        splitResult == "Decrease in price" ? counterparty : partyBidder;
      return Do(
        looser.party
          .transfer(Min(deltaPrice, looser.deposit), lovelace)
          .to(winner.party),
        Close
        // TODO: This is for explicit refunds
        // If(true).then(Close).else(Close)
      );
    });

  return Do(
    SetContingency(
      Chain(
        waitFor(
          partyBidder.party
            .deposits(partyBidder.deposit, lovelace)
            .intoAccount(partyBidder.party)
        ),
        waitFor(
          counterparty.party
            .deposits(counterparty.deposit, lovelace)
            .intoAccount(counterparty.party)
        )
      )
    ).after(depositDeadline, Close),
    waitUntil(firstWindow.beginning),
    oracleChooses(exchangeBegining, firstWindow.deadline),
    waitUntil(secondWindow.beginning),
    oracleChooses(exchangeEnd, secondWindow.deadline),
    Let(
      "Price in second window",
      Div(
        Mul(priceBeginning, Mul(exchangeBegining.value(), exchangeEnd.value())),
        10_000_000_000_000_000n
      )
    ).in((priceInSecondWindow) =>
      If(priceBeginning.greaterThan(priceInSecondWindow))
        .then(
          splitDifference(
            "Decrease in price",
            priceBeginning,
            priceInSecondWindow
          )
        )
        .else(
          If(priceBeginning.lowerThan(priceInSecondWindow))
            .then(
              splitDifference(
                "Increase in price",
                priceBeginning,
                priceInSecondWindow
              )
            )
            .else(fullRefund)
        )
    )
  );
}

const s = cfd({
  partyBidder: {
    party: Role("party"),
    deposit: Constant(10_000_000),
  },
  counterparty: {
    party: Role("counterparty"),
    deposit: Constant(20_000_000),
  },
  oracle: Role("kraken"),
  depositDeadline: new Date("2024-06-21T15:24:00.000Z"),
  firstWindow: {
    beginning: new Date("2024-06-21T15:34:00.000Z"),
    deadline: new Date("2024-06-21T15:39:00.000Z"),
  },
  secondWindow: {
    beginning: new Date("2024-06-21T15:44:00.000Z"),
    deadline: new Date("2024-06-21T15:49:00.000Z"),
  },
  exchangeBegining: Role("kraken")
    .chooses("dir-adausd")
    .between(Bound(0n, 100_000_000_000n)),
  exchangeEnd: Role("kraken")
    .chooses("inv-adausd")
    .between(Bound(0n, 100_000_000_000n)),
  priceBeginning: Constant(5_000_000),
});

console.log(s.stringify());
