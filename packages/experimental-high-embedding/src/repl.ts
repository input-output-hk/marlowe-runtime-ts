import {
  Role,
  Add,
  lovelace,
  Close,
  Pay,
  account,
  Contract,
  If,
  When,
  SetContingency,
  Party,
  Do,
  waitFor,
  Value,
  Div,
  Mul,
  Constant,
  choiceId,
  Bound,
  choice,
} from "./index.js";

const buyer = Role("buyer");

const v = buyer.availableMoney(lovelace);
buyer.deposits([3, lovelace]);

buyer.chooses("Something").between(Bound(3n, 5n), Bound(6n, 8n));
const dayOfWeek = choice("day").between(Bound(1n, 7n));
buyer.chooses(dayOfWeek);

const v1 = Add(3, 4);
const v2 = Add(3, 4).add(3);
const v3 = Add(3, Add(4, 3));
const v4 = Add(3, 4).sub(2);

// console.log(JSON.stringify(v4));
// console.log(v4.eval());
// console.log(JSON.stringify(v2.eq(v4)))
// console.log(v2.eq(v4).eval())

// const c1 = Pay(buyer, account(buyer), ada, Add(3, 2)).then(Close);
const c1 = buyer.transfer(Add(3, 2), lovelace).to(buyer).then(Close);
const c2 = Pay(buyer, account(buyer), lovelace, Add(3, 2), Close);

const c3: Contract = If(true).then(Close).else(c2);

const c4: Contract = If(true, Close, c2);

const c5 = When([]).after(new Date(), Close);
const c6 = When([buyer.deposits(2, lovelace).intoAccount(buyer).then(Close)]);

const c7 = SetContingency(
  When([buyer.deposits(3, lovelace).intoAccount(buyer).then(Close)])
).after(new Date("2024-05-26T12:34:56.789Z"), Close);

const example = (a: Party, b: Party) =>
  Do(
    waitFor(b.deposits(1, lovelace).intoAccount(a)).after(
      new Date("2023-06-21T13:40:10.000Z"),
      Close
    ),
    a.payOut(1, lovelace).to(b),
    Close
  );

const example3 = (a: Party, b: Party) =>
  SetContingency(
    Do(
      waitFor(b.deposits(1, lovelace).intoAccount(a)),
      a.payOut(1, lovelace).to(b),
      Close
    )
  ).after(new Date("2023-06-21T13:40:10.000Z"), Close);

const example2 = (a: Party, b: Party) =>
  When([
    b.deposits(1, lovelace).intoAccount(a).then(
      a
        .payOut(1, lovelace)
        .to(b)
        // Comment to force newline in formatter
        .then(Close)
    ),
  ]).after(new Date("2023-06-21T13:40:10.000Z"), Close);

console.log(JSON.stringify(example(Role("a"), Role("b"))));
const amountWithTaxes = (v: Value) => Add(v, Div(Mul(v, 21), 100));

const amountWithTaxes2 = (v: Value) => v.add(v.mul(21).div(100));

const amountWithTaxes3 = (v: number) =>
  Constant(Math.floor(v + (v * 21) / 100));

amountWithTaxes(Constant(2));
amountWithTaxes2(Constant(2));
amountWithTaxes3(2);
// console.log(JSON.stringify(c3));
// console.log(JSON.stringify(c4));
// console.log(JSON.stringify(c2));
