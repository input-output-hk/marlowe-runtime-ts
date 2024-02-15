import { sha1 } from "object-hash";
import {
  arrayOf,
  bigint,
  bool,
  lit,
  num,
  objOf,
  str,
  unk,
} from "./typeguards.js";
import jsonBigInt from "json-bigint";
import { ObjectContract } from "@marlowe.io/marlowe-object/bundle-map";

type IntoAccount = {
  intoAccount: (to: Party) => DepositAction;
  intoOwnAccount: () => DepositAction;
};
type ChoiceBetween = { between: (...bounds: Bound[]) => ChoiceAction };
type PayTo = { to: (dst: Party) => ThenableContract };

export abstract class Party {
  static parse(obj: unknown): Party {
    if (objOf({ address: str })(obj)) {
      return Address(obj.address);
    }
    if (objOf({ role_token: str })(obj)) {
      return Role(obj.role_token);
    }

    throw new Error("Object is not a Party");
  }

  deposits(asset: SingleAssetValue): IntoAccount;
  deposits(value: ValueOrNumber, token: Token): IntoAccount;
  deposits(...args: [SingleAssetValue] | [ValueOrNumber, Token]): IntoAccount {
    const from = this;
    const tok = args.length == 1 ? args[0][1] : args[1];
    const val = args.length == 1 ? args[0][0] : args[0];
    return {
      intoAccount: (to: Party) => {
        return Deposit(to, from, tok, val);
      },
      intoOwnAccount: () => {
        return Deposit(from, from, tok, val);
      },
    };
  }

  chooses(choice: Choice): ChoiceAction;
  chooses(choiceName: string): ChoiceBetween;
  chooses(arg: string | Choice) {
    if (str(arg)) {
      return {
        between: (...bounds: Bound[]) =>
          new ChoiceAction(choiceId(arg, this), bounds),
      };
    } else {
      return new ChoiceAction(choiceId(arg.choiceName, this), arg.bounds);
    }
  }

  transfer(asset: SingleAssetValue): PayTo;
  transfer(value: ValueOrNumber, token: Token): PayTo;
  transfer(...args: [SingleAssetValue] | [ValueOrNumber, Token]) {
    const from = this;
    const tok = args.length == 1 ? args[0][1] : args[1];
    const val = args.length == 1 ? args[0][0] : args[0];

    return {
      to: (dst: Party) => {
        return {
          then: (cont: Contract) => {
            return new PayC(from, account(dst), tok, val, cont);
          },
        };
      },
    };
  }

  payOut(asset: SingleAssetValue): PayTo;
  payOut(value: ValueOrNumber, token: Token): PayTo;
  payOut(...args: [SingleAssetValue] | [ValueOrNumber, Token]) {
    const from = this;
    const tok = args.length == 1 ? args[0][1] : args[1];
    const val = args.length == 1 ? args[0][0] : args[0];
    return {
      to: (dst: Party) => {
        return {
          then: (cont: Contract) => {
            return new PayC(from, party(dst), tok, val, cont);
          },
        };
      },
    };
  }
  availableMoney(token: Token) {
    return new AvailableMoneyValue(this, token);
  }
}

class RoleParty extends Party {
  constructor(public roleName: string) {
    super();
  }
  toJSON() {
    return { role_token: this.roleName };
  }
}
export function Role(roleName: string) {
  return new RoleParty(roleName);
}

class AddressParty extends Party {
  constructor(public address: string) {
    super();
  }
  toJSON() {
    return { address: this.address };
  }
}

export function Address(address: string) {
  return new AddressParty(address);
}

export type SingleAssetValue = [ValueOrNumber, Token];
export type SingleAsset = [number, Token];

export class Token {
  constructor(
    public currencySymbol: Readonly<string>,
    public tokenName: Readonly<string>
  ) {}
  static parse(obj: unknown): Token {
    if (objOf({ currency_symbol: str, token_name: str })(obj)) {
      return new Token(obj.currency_symbol, obj.token_name);
    }
    throw new Error("Object is not a Token");
  }
  toJSON() {
    return {
      currency_symbol: this.currencySymbol,
      token_name: this.tokenName,
    };
  }
}

export function token(currencySymbol: string, tokenName: string): Token {
  return new Token(currencySymbol, tokenName);
}

export const lovelace = token("", "");

export abstract class Payee {
  static parse(obj: unknown): Payee {
    if (objOf({ party: unk })(obj)) {
      return party(Party.parse(obj.party));
    }
    if (objOf({ account: unk })(obj)) {
      return account(Party.parse(obj.account));
    }

    throw new Error("Object is not a Party");
  }
  match<T>(
    matchAccount: (p: AccountPayee) => T,
    matchParty: (p: PartyPayee) => T
  ): T {
    if (this instanceof PartyPayee) {
      return matchParty(this);
    }
    if (this instanceof AccountPayee) {
      return matchAccount(this);
    }
    throw new Error("no Payee match");
  }
}

class PartyPayee extends Payee {
  constructor(public party: Party) {
    super();
  }
  toJSON() {
    return { party: this.party };
  }
}

class AccountPayee extends Payee {
  constructor(public account: Party) {
    super();
  }
  toJSON() {
    return { account: this.account };
  }
}
export function account(p: Party) {
  return new AccountPayee(p);
}

export function party(p: Party) {
  return new PartyPayee(p);
}

export class ChoiceId {
  constructor(
    public choiceName: string,
    public choiceOwner: Party
  ) {}
  value() {
    return new ChoiceValueValue(this);
  }
  static parse(val: unknown): ChoiceId {
    if (objOf({ choice_name: str, choice_owner: unk })(val)) {
      return new ChoiceId(val.choice_name, Party.parse(val.choice_owner));
    }
    throw new Error("Value is not a choiceId");
  }
  toJSON() {
    return { choice_name: this.choiceName, choice_owner: this.choiceOwner };
  }
}

export function choiceId(choiceName: string, choiceOwner: Party): ChoiceId {
  return new ChoiceId(choiceName, choiceOwner);
}
// TODO refactor to bigint
export type Bound = { from: number; to: number };
export function Bound(from: number, to: number): Bound {
  return { from, to };
}

Bound.parse = function (val: unknown): Bound {
  if (objOf({ from: num, to: num })(val)) {
    return val;
  }
  throw new Error("Value is not a Bound");
};

export abstract class Value {
  static parse(val: unknown): Value {
    if (lit("time_interval_start")(val)) {
      return new TimeIntervalStartValue();
    }
    if (lit("time_interval_end")(val)) {
      return new TimeIntervalEndValue();
    }
    if (num(val) || bigint(val)) {
      return new ConstantValue(BigInt(val));
    }
    if (objOf({ in_account: unk, amount_of_token: unk })(val)) {
      return new AvailableMoneyValue(
        Party.parse(val.in_account),
        Token.parse(val.amount_of_token)
      );
    }
    if (objOf({ add: unk, and: unk })(val)) {
      return new AddValue(Value.parse(val.add), Value.parse(val.and));
    }
    if (objOf({ negate: unk })(val)) {
      return new NegValue(Value.parse(val.negate));
    }

    if (objOf({ multiply: unk, times: unk })(val)) {
      return new MulValue(Value.parse(val.multiply), Value.parse(val.times));
    }

    if (objOf({ divide: unk, by: unk })(val)) {
      return new DivValue(Value.parse(val.divide), Value.parse(val.by));
    }

    if (objOf({ value: unk, minus: unk })(val)) {
      return new SubValue(Value.parse(val.value), Value.parse(val.minus));
    }

    if (objOf({ use_value: str })(val)) {
      return new UseValue(val.use_value);
    }
    if (objOf({ if: unk, then: unk, else: unk })(val)) {
      return new CondValue(
        Observation.parse(val.if),
        Value.parse(val.then),
        Value.parse(val.else)
      );
    }
    if (objOf({ value_of_choice: unk })(val)) {
      return new ChoiceValueValue(ChoiceId.parse(val.value_of_choice));
    }
    throw new Error("Object is not a Value: " + jsonBigInt.stringify(val));
  }

  abstract eval(env: Environment, state: State): bigint;

  neg() {
    return Neg(this);
  }

  add(right: ValueOrNumber) {
    return Add(this, right);
  }

  sub(right: ValueOrNumber) {
    return Sub(this, right);
  }

  mul(right: ValueOrNumber) {
    return Mul(this, right);
  }

  div(by: ValueOrNumber) {
    return Div(this, by);
  }

  eq(right: ValueOrNumber) {
    return Eq(this, right);
  }
  greaterOrEqual(right: ValueOrNumber) {
    return ValueGE(this, right);
  }
  greaterThan(right: ValueOrNumber) {
    return ValueGT(this, right);
  }

  lowerThan(right: ValueOrNumber) {
    return ValueLT(this, right);
  }
}

export type ValueOrNumber = Value | number | bigint;

const numberToConstant = (val: ValueOrNumber): Value => {
  if (typeof val == "number") {
    return new ConstantValue(BigInt(val));
  } else if (typeof val == "bigint") {
    return new ConstantValue(val);
  } else return val;
};

class AvailableMoneyValue extends Value {
  constructor(
    public accountId: Party,
    public token: Token
  ) {
    super();
  }
  eval(env: Environment, state: State) {
    return state.accounts.availableMoney(this.accountId, this.token);
  }
  toJSON() {
    return { amount_of_token: this.token, in_account: this.accountId };
  }
}

class ChoiceValueValue extends Value {
  constructor(public choiceId: ChoiceId) {
    super();
  }
  eval(env: Environment, state: State) {
    return state.choices.get(choiceIdKey(this.choiceId)) ?? 0n;
  }
  toJSON() {
    return { value_of_choice: this.choiceId };
  }
}
export function AvailableMoney(accountId: Party, token: Token) {
  return new AvailableMoneyValue(accountId, token);
}

class ConstantValue extends Value {
  constructor(private val: bigint) {
    super();
  }
  eval() {
    return this.val;
  }
  toJSON() {
    return this.val;
  }
}

export function Constant(n: number | bigint) {
  return new ConstantValue(BigInt(n));
}

class NegValue extends Value {
  val: Value;
  constructor(val: ValueOrNumber) {
    super();
    this.val = numberToConstant(val);
  }
  eval(env: Environment, state: State) {
    return -this.val.eval(env, state);
  }
  toJSON() {
    return { negate: this.val };
  }
}

export function Neg(val: ValueOrNumber) {
  return new NegValue(val);
}

class AddValue extends Value {
  constructor(
    public left: Value,
    public right: Value
  ) {
    super();
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) + this.right.eval(env, state);
  }
  toJSON() {
    return { add: this.left, and: this.right };
  }
}

export function Add(left: ValueOrNumber, right: ValueOrNumber) {
  return new AddValue(numberToConstant(left), numberToConstant(right));
}

class SubValue extends Value {
  constructor(
    public left: Value,
    public right: Value
  ) {
    super();
    this.left = numberToConstant(left);
    this.right = numberToConstant(right);
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) - this.right.eval(env, state);
  }
  toJSON() {
    return { value: this.left, minus: this.right };
  }
}

export function Sub(left: ValueOrNumber, right: ValueOrNumber) {
  return new SubValue(numberToConstant(left), numberToConstant(right));
}

class MulValue extends Value {
  constructor(
    public left: Value,
    public right: Value
  ) {
    super();
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) * this.right.eval(env, state);
  }
  toJSON() {
    return { multiply: this.left, times: this.right };
  }
}

export function Mul(left: ValueOrNumber, right: ValueOrNumber) {
  return new MulValue(numberToConstant(left), numberToConstant(right));
}

class DivValue extends Value {
  constructor(
    public divide: Value,
    public by: Value
  ) {
    super();
    this.divide = numberToConstant(divide);
    this.by = numberToConstant(by);
  }
  eval(env: Environment, state: State) {
    return this.divide.eval(env, state) / this.by.eval(env, state);
  }
  toJSON() {
    return { divide: this.divide, by: this.by };
  }
}

export function Div(divide: ValueOrNumber, by: ValueOrNumber) {
  return new DivValue(numberToConstant(divide), numberToConstant(by));
}

type ValueId = string;

class UseValue extends Value {
  constructor(public valueId: ValueId) {
    super();
  }
  eval(env: Environment, state: State) {
    // return Math.round(this.divide.eval(env, state) / this.by.eval(env, state));
    // TODO: implement
    return state.boundValues.get(this.valueId) ?? 0n;
  }
  toJSON() {
    return { use_value: this.valueId };
  }
}

export function Use(valueId: ValueId) {
  return new UseValue(valueId);
}

class CondValue extends Value {
  obs: Observation;
  ifTrue: Value;
  ifFalse: Value;
  constructor(
    obs: ObservationOrBool,
    ifTrue: ValueOrNumber,
    ifFalse: ValueOrNumber
  ) {
    super();
    this.obs = boolToConstant(obs);
    this.ifTrue = numberToConstant(ifTrue);
    this.ifFalse = numberToConstant(ifFalse);
  }
  eval(env: Environment, state: State) {
    if (this.obs.eval(env, state)) {
      return this.ifTrue.eval(env, state);
    } else {
      return this.ifFalse.eval(env, state);
    }
  }
  toJSON() {
    return { if: this.obs, then: this.ifTrue, else: this.ifFalse };
  }
}

export function Cond(
  obs: ObservationOrBool,
  ifTrue: ValueOrNumber,
  ifFalse: ValueOrNumber
) {
  return new CondValue(obs, ifTrue, ifFalse);
}

class TimeIntervalStartValue extends Value {
  eval(env: Environment, _: State) {
    return BigInt(env.timeInterval.from.getTime());
  }
  toJSON() {
    return "time_interval_start";
  }
}

export const TimeIntervalStart = new TimeIntervalStartValue();

class TimeIntervalEndValue extends Value {
  eval(env: Environment, _: State) {
    return BigInt(env.timeInterval.to.getTime());
  }
  toJSON() {
    return "time_interval_end";
  }
}

export const TimeIntervalEnd = new TimeIntervalEndValue();

export function Max(a: Value, b: Value): Value {
  return Cond(a.greaterThan(b), a, b);
}
export function Min(a: Value, b: Value): Value {
  return Cond(a.lowerThan(b), a, b);
}

export abstract class Observation {
  static parse(val: unknown): Observation {
    if (bool(val)) {
      return new ConstantObs(val);
    }

    if (objOf({ both: unk, and: unk })(val)) {
      return new AndObs(
        Observation.parse(val.both),
        Observation.parse(val.and)
      );
    }
    if (objOf({ either: unk, or: unk })(val)) {
      return new OrObs(
        Observation.parse(val.either),
        Observation.parse(val.or)
      );
    }
    if (objOf({ value: unk, equal_to: unk })(val)) {
      return new ValueEq(Value.parse(val.value), Value.parse(val.equal_to));
    }
    if (objOf({ value: unk, ge_than: unk })(val)) {
      return ValueGE(Value.parse(val.value), Value.parse(val.ge_than));
    }
    if (objOf({ value: unk, gt: unk })(val)) {
      return ValueGT(Value.parse(val.value), Value.parse(val.gt));
    }

    if (objOf({ value: unk, lt: unk })(val)) {
      return ValueLT(Value.parse(val.value), Value.parse(val.lt));
    }
    if (objOf({ value: unk, le_than: unk })(val)) {
      return ValueLE(Value.parse(val.value), Value.parse(val.le_than));
    }
    if (objOf({ not: unk })(val)) {
      return Not(Observation.parse(val.not));
    }
    if (objOf({ chose_something_for: unk })(val)) {
      return new ChoseSomething(ChoiceId.parse(val.chose_something_for));
    }
    throw new Error(
      "Object is not an Observation: " + jsonBigInt.stringify(val)
    );
  }
  abstract eval(env: Environment, state: State): boolean;
  and(right: Observation) {
    return And(this, right);
  }
  or(right: Observation) {
    return Or(this, right);
  }
  not() {
    return Not(this);
  }
}

class AndObs extends Observation {
  left: Observation;
  right: Observation;
  constructor(left: ObservationOrBool, right: ObservationOrBool) {
    super();
    this.left = boolToConstant(left);
    this.right = boolToConstant(right);
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) && this.right.eval(env, state);
  }
  toJSON() {
    return { both: this.left, and: this.right };
  }
}

export function And(left: ObservationOrBool, right: ObservationOrBool) {
  return new AndObs(left, right);
}

class OrObs extends Observation {
  left: Observation;
  right: Observation;
  constructor(left: ObservationOrBool, right: ObservationOrBool) {
    super();
    this.left = boolToConstant(left);
    this.right = boolToConstant(right);
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) || this.right.eval(env, state);
  }
  toJSON() {
    return { either: this.left, or: this.right };
  }
}

export function Or(left: ObservationOrBool, right: ObservationOrBool) {
  return new OrObs(left, right);
}

class NotObs extends Observation {
  val: Observation;
  constructor(val: ObservationOrBool) {
    super();
    this.val = boolToConstant(val);
  }
  eval(env: Environment, state: State) {
    return !this.val.eval(env, state);
  }
  toJSON() {
    return { not: this.val };
  }
}

export function Not(val: ObservationOrBool) {
  return new NotObs(val);
}

class ValueEq extends Observation {
  left: Value;
  right: Value;
  constructor(left: ValueOrNumber, right: ValueOrNumber) {
    super();
    this.left = numberToConstant(left);
    this.right = numberToConstant(right);
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) === this.right.eval(env, state);
  }
  toJSON() {
    return { value: this.left, equal_to: this.right };
  }
}

export function Eq(left: ValueOrNumber, right: ValueOrNumber) {
  return new ValueEq(left, right);
}

class ValueGEObs extends Observation {
  left: Value;
  right: Value;
  constructor(left: ValueOrNumber, right: ValueOrNumber) {
    super();
    this.left = numberToConstant(left);
    this.right = numberToConstant(right);
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) >= this.right.eval(env, state);
  }
  toJSON() {
    return { value: this.left, ge_than: this.right };
  }
}

export function ValueGE(left: ValueOrNumber, right: ValueOrNumber) {
  return new ValueGEObs(left, right);
}

class ValueGTObs extends Observation {
  left: Value;
  right: Value;
  constructor(left: ValueOrNumber, right: ValueOrNumber) {
    super();
    this.left = numberToConstant(left);
    this.right = numberToConstant(right);
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) > this.right.eval(env, state);
  }
  toJSON() {
    return { value: this.left, gt: this.right };
  }
}

export function ValueGT(left: ValueOrNumber, right: ValueOrNumber) {
  return new ValueGTObs(left, right);
}

class ValueLTObs extends Observation {
  left: Value;
  right: Value;
  constructor(left: ValueOrNumber, right: ValueOrNumber) {
    super();
    this.left = numberToConstant(left);
    this.right = numberToConstant(right);
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) < this.right.eval(env, state);
  }
  toJSON() {
    return { value: this.left, lt: this.right };
  }
}

export function ValueLT(left: ValueOrNumber, right: ValueOrNumber) {
  return new ValueLTObs(left, right);
}

class ValueLEObs extends Observation {
  left: Value;
  right: Value;
  constructor(left: ValueOrNumber, right: ValueOrNumber) {
    super();
    this.left = numberToConstant(left);
    this.right = numberToConstant(right);
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) <= this.right.eval(env, state);
  }
  toJSON() {
    return { value: this.left, le_than: this.right };
  }
}

export function ValueLE(left: ValueOrNumber, right: ValueOrNumber) {
  return new ValueLEObs(left, right);
}

class ChoseSomething extends Observation {
  constructor(public choiceId: ChoiceId) {
    super();
  }
  eval(env: Environment, state: State) {
    return state.choices.has(choiceIdKey(this.choiceId));
  }
  toJSON() {
    return {
      chose_something_for: this.choiceId,
    };
  }
}
export class ConstantObs extends Observation {
  constructor(private obs: boolean) {
    super();
  }
  eval() {
    return this.obs;
  }
  toJSON() {
    return this.obs;
  }
}

type ObservationOrBool = Observation | boolean;

const boolToConstant = (obs: ObservationOrBool): Observation =>
  typeof obs == "boolean" ? new ConstantObs(obs) : obs;

type Payment = {
  payment_from: Party;
  to: Payee;
  token: Token;
  amount: bigint;
};

type NonPositivePayWarning = {
  warningType: "NonPositivePay";
  accountId: Party;
  payee: Payee;
  token: Token;
  value: bigint;
};

type PartialPayWarning = {
  warningType: "PartialPay";
  accountId: Party;
  payee: Payee;
  token: Token;
  expected: bigint;
  actual: bigint;
};

type ShadowWarning = {
  warningType: "Shadow";
  valueId: string;
  previousValue: bigint;
  newValue: bigint;
};

type AssertionWarning = {
  warningType: "Assertion";
};

type ReduceWarning =
  | NonPositivePayWarning
  | PartialPayWarning
  | ShadowWarning
  | AssertionWarning;

type ReduceEffect =
  | {
      reduceEffect: "notReduced";
    }
  | {
      reduceEffect: "reduced";
      warning?: ReduceWarning;
      payment?: Payment;
      state: State;
      cont: Contract;
    };
type AmbiguousTimeIntervalError = {
  errorType: "AmbiguousTimeInterval";
};

type ReduceStepResult = ReduceEffect | AmbiguousTimeIntervalError;

type ReduceResult =
  | {
      reduced: boolean;
      warnings: ReduceWarning[];
      payments: Payment[];
      state: State;
      cont: Contract;
    }
  | AmbiguousTimeIntervalError;

function notReduced(res: ReduceStepResult) {
  return "errorType" in res || res.reduceEffect == "notReduced";
}
export abstract class Contract {
  protected built = false;
  abstract __build(): void;
  defaultContingency: Contingency | undefined;
  abstract get continuations(): Readonly<Map<string, Contract>>;
  protected abstract reduceContractStep(
    env: Environment,
    state: State
  ): ReduceStepResult;

  stringify() {
    return jsonBigInt.stringify(this);
  }

  static parse(val: unknown): Contract {
    if (lit("close")(val)) {
      return Close;
    }
    if (
      objOf({ from_account: unk, to: unk, token: unk, pay: unk, then: unk })(
        val
      )
    ) {
      return Pay(
        Party.parse(val.from_account),
        Payee.parse(val.to),
        Token.parse(val.token),
        Value.parse(val.pay),
        Contract.parse(val.then)
      );
    }
    if (objOf({ if: unk, then: unk, else: unk })(val)) {
      return If(
        Observation.parse(val.if),
        Contract.parse(val.then),
        Contract.parse(val.else)
      );
    }
    if (
      objOf({ when: arrayOf(unk), timeout: num, timeout_continuation: unk })(
        val
      )
    ) {
      return When(val.when.map(Case.parse)).after(
        new Date(val.timeout),
        Contract.parse(val.timeout_continuation)
      );
    }
    if (objOf({ let: str, be: unk, then: unk })(val)) {
      return new LetC(val.let, Value.parse(val.be), Contract.parse(val.then));
    }
    if (objOf({ assert: unk, then: unk })(val)) {
      return new AssertC(
        Observation.parse(val.assert),
        Contract.parse(val.then)
      );
    }
    throw new Error("Object is not a contract: " + jsonBigInt.stringify(val));
  }
  reduceContractUntilQuiescent(
    this: Contract,
    env: Environment,
    state: State
  ): ReduceResult {
    this.__build();
    let reduced = false;
    let cont = this;
    let warnings = [] as ReduceWarning[];
    let payments = [] as Payment[];

    do {
      let reduceResult = cont.reduceContractStep(env, state);
      if ("errorType" in reduceResult) return reduceResult;
      if (reduceResult.reduceEffect == "notReduced") {
        return { reduced, warnings, payments, cont, state };
      }
      reduced = true;
      if (reduceResult.payment) {
        payments.push(reduceResult.payment);
      }
      if (reduceResult.warning) {
        warnings.push(reduceResult.warning);
      }
      cont = reduceResult.cont;
      state = reduceResult.state;
    } while (true);
  }
  getRuntimeObject() {
    let thisHash = this.hash();
    let objects: { [key: string]: ObjectContract<unknown> } = {};
    objects[thisHash] = {
      type: "contract",
      value: this as any,
    };
    this.continuations.forEach(
      (contract, sym) =>
        (objects[sym] = {
          type: "contract",
          value: contract as any,
        })
    );
    return jsonBigInt.stringify({
      objects,
      main: thisHash,
    });
  }
  do(...chain: DoableContract) {
    return Do(...chain);
  }
  isClose() {
    return this instanceof CloseC;
  }
  isPay() {
    return this instanceof PayC;
  }
  hash() {
    return sha1(jsonBigInt.stringify(this));
  }
}

class CloseC extends Contract {
  __build() {}
  get continuations() {
    return new Map();
  }
  protected reduceContractStep(_: Environment, state: State): ReduceStepResult {
    const accs = state.accounts.values();
    if (accs.length == 0) {
      return { reduceEffect: "notReduced" };
    } else {
      const [refund, ...newAccs] = accs;
      const payment = {
        payment_from: refund[0],
        to: party(refund[0]),
        token: refund[1],
        amount: refund[2],
      };
      return {
        reduceEffect: "reduced",
        payment,
        state: state.updateAccounts(new Accounts(newAccs)),
        cont: this,
      };
    }
  }

  toJSON() {
    return "close";
  }
}

function bigIntMin(...val: bigint[]) {
  let min = val[0];
  val.forEach((n) => (min = n < min ? n : min));
  return min;
}

class PayC extends Contract {
  value: Value;
  private _continuations?: Map<string, Contract>;
  constructor(
    private from: Party,
    private to: Payee,
    private token: Token,
    value: ValueOrNumber,
    private cont: Contract
  ) {
    super();
    this.value = numberToConstant(value);
  }
  __build() {
    if (this.built) {
      return;
    }
    this.built = true;
    if (typeof this.cont.defaultContingency == "undefined") {
      this.cont.defaultContingency = this.defaultContingency;
    }
    this.cont.__build();
    this._continuations = this.cont.continuations;
  }
  protected reduceContractStep(
    env: Environment,
    state: State
  ): ReduceStepResult {
    const amountToPay = this.value.eval(env, state);
    if (amountToPay <= 0) {
      return {
        reduceEffect: "reduced",
        warning: {
          warningType: "NonPositivePay",
          accountId: this.from,
          payee: this.to,
          token: this.token,
          value: amountToPay,
        },
        state,
        cont: this.cont,
      };
    }
    const balance = state.accounts.availableMoney(this.from, this.token);
    const paidAmount = bigIntMin(balance, amountToPay);
    const newBalance = balance - paidAmount;
    const accsWithoutSource = state.accounts.set(
      this.from,
      this.token,
      newBalance
    );
    const warning =
      paidAmount < amountToPay
        ? {
            warningType: "PartialPay" as const,
            accountId: this.from,
            payee: this.to,
            token: this.token,
            expected: amountToPay,
            actual: paidAmount,
          }
        : undefined;
    const finalAccs = this.to.match(
      ({ account }) =>
        accsWithoutSource.set(
          account,
          this.token,
          accsWithoutSource.availableMoney(account, this.token) + paidAmount
        ),
      () => accsWithoutSource
    );
    const payment = {
      payment_from: this.from,
      to: this.to,
      token: this.token,
      amount: paidAmount,
    };
    const newState = state.updateAccounts(finalAccs);
    return {
      reduceEffect: "reduced",
      warning,
      payment,
      state: newState,
      cont: this.cont,
    };
  }
  get continuations() {
    this.__build();
    if (!this._continuations) {
      throw new Error("Continuations not initialized");
    }
    return this._continuations;
  }
  toJSON() {
    this.__build();
    return {
      from_account: this.from,
      to: this.to,
      token: this.token,
      pay: this.value,
      then: this.cont,
    };
  }
}

class AssertC extends Contract {
  __build(): void {
    if (this.built) {
      return;
    }
    this.built = true;
    if (typeof this.cont.defaultContingency == "undefined") {
      this.cont.defaultContingency = this.defaultContingency;
    }
    this.cont.__build();
    this._continuations = this.cont.continuations;
  }
  private _continuations?: Map<string, Contract>;

  get continuations() {
    this.__build();
    if (!this._continuations) {
      throw new Error("Continuations not initialized");
    }
    return this._continuations;
  }
  protected reduceContractStep(
    env: Environment,
    state: State
  ): ReduceStepResult {
    throw new Error("Method not implemented.");
  }
  constructor(
    public obs: Observation,
    public cont: Contract
  ) {
    super();
  }
  toJSON() {
    return {
      assert: this.obs,
      then: this.cont,
    };
  }
}
class LetC extends Contract {
  private _continuations?: Map<string, Contract>;

  get continuations() {
    this.__build();
    if (!this._continuations) {
      throw new Error("Continuations not initialized");
    }
    return this._continuations;
  }
  __build(): void {
    if (this.built) {
      return;
    }
    this.built = true;
    if (typeof this.cont.defaultContingency == "undefined") {
      this.cont.defaultContingency = this.defaultContingency;
    }
    this.cont.__build();
    this._continuations = this.cont.continuations;
  }

  protected reduceContractStep(
    env: Environment,
    state: State
  ): ReduceStepResult {
    throw new Error("Method not implemented.");
  }
  constructor(
    public valueId: string,
    public value: Value,
    public cont: Contract
  ) {
    super();
  }
  toJSON() {
    return {
      let: this.valueId,
      be: this.value,
      then: this.cont,
    };
  }
}

type LetInBody = (ref: Value) => Contract;
// TODO: Add overrides
export function Let(id: string, value: ValueOrNumber) {
  return {
    then: (cont: Contract) => {
      return new LetC(id, numberToConstant(value), cont);
    },
    in: (body: LetInBody) => {
      return new LetC(id, numberToConstant(value), body(new UseValue(id)));
    },
  };
}
class IfC extends Contract {
  private _continuations?: Map<string, Contract>;
  private obs: Observation;
  constructor(
    obs: ObservationOrBool,
    private ifTrue: Contract,
    private ifFalse: Contract
  ) {
    super();
    this.obs = boolToConstant(obs);
  }
  __build() {
    if (this.built) {
      return;
    }
    this.built = true;
    if (typeof this.ifTrue.defaultContingency == "undefined") {
      this.ifTrue.defaultContingency = this.defaultContingency;
    }
    if (typeof this.ifFalse.defaultContingency == "undefined") {
      this.ifFalse.defaultContingency = this.defaultContingency;
    }
    this.ifTrue.__build();
    this.ifFalse.__build();
    this._continuations = new Map([
      ...this.ifTrue.continuations,
      ...this.ifFalse.continuations,
    ]);
  }
  get continuations() {
    this.__build();
    if (!this._continuations) {
      throw new Error("Continuations not initialized");
    }
    return this._continuations;
  }

  protected reduceContractStep(
    env: Environment,
    state: State
  ): ReduceStepResult {
    const cont = this.obs.eval(env, state) ? this.ifTrue : this.ifFalse;
    return { reduceEffect: "reduced", state, cont };
  }

  toJSON() {
    this.__build();

    return { if: this.obs, then: this.ifTrue, else: this.ifFalse };
  }
}

export type Contingency = [Date, Contract];

const defaultContingency = [new Date(0), new CloseC()] as Contingency;

// TODO: Implement
type Input = String;

export abstract class Case {
  protected built = false;
  abstract __build(): void;
  static parse(val: unknown): Case {
    if (objOf({ case: unk, then: unk })(val)) {
      return new NormalCase(Action.parse(val.case), Contract.parse(val.then));
    }
    // if (objOf({ case: unk, merkleized_then: str })(val)) {
    //   return new MerkleizedCase(Action.parse(val.case), val.merkleized_then);
    // }

    throw new Error("Object is not a Case: " + jsonBigInt.stringify(val));
  }
  defaultContingency: Contingency | undefined;
  abstract continuations: Map<string, Contract>;
}

class NormalCase extends Case {
  private _continuations?: Map<string, Contract>;
  constructor(
    public action: Action,
    public cont: Contract
  ) {
    super();
  }
  __build() {
    if (this.built) {
      return;
    }
    this.built = true;

    if (typeof this.cont.defaultContingency == "undefined") {
      this.cont.defaultContingency = this.defaultContingency;
    }
    this.cont.__build();
    this._continuations = this.cont.continuations;
  }
  get continuations() {
    this.__build();
    if (!this._continuations) {
      throw new Error("Continuations not initialized");
    }
    return this._continuations;
  }
  toJSON() {
    this.__build();
    return {
      case: this.action,
      then: this.cont,
    };
  }
}

// TODO: Refactor to Ref constructor.
class MerkleizedCase extends Case {
  private _continuations?: Map<string, Contract>;
  continuationHash: string;
  constructor(
    public action: Action,
    public cont: Contract
  ) {
    super();
  }
  __build() {
    if (this.built) {
      return;
    }
    this.built = true;

    if (typeof this.cont.defaultContingency == "undefined") {
      this.cont.defaultContingency = this.defaultContingency;
    }
    this.cont.__build();
    this.continuationHash = this.cont.hash();
    this._continuations = new Map([...this.cont.continuations]);
    this._continuations.set(this.continuationHash, this.cont);
  }
  get continuations() {
    this.__build();
    if (!this._continuations) {
      throw new Error("Continuations not initialized");
    }
    return this._continuations;
  }
  toJSON() {
    this.__build();
    return {
      case: this.action,
      then: { ref: this.continuationHash },
    };
  }
}
export abstract class Action {
  static parse(val: unknown): Action {
    if (objOf({ notify_if: unk })(val)) {
      return new NotifyAction(Observation.parse(val.notify_if));
    }
    if (
      objOf({ deposits: unk, into_account: unk, of_token: unk, party: unk })(
        val
      )
    ) {
      return new DepositAction(
        Party.parse(val.into_account),
        Party.parse(val.party),
        Token.parse(val.of_token),
        Value.parse(val.deposits)
      );
    }
    if (objOf({ choose_between: arrayOf(unk), for_choice: unk })(val)) {
      return new ChoiceAction(
        ChoiceId.parse(val.for_choice),
        val.choose_between.map(Bound.parse)
      );
    }
    throw new Error("Object not an action: " + jsonBigInt.stringify(val));
  }
  abstract match(input: Input): boolean;
  then(cont: Contract | (() => Contract)): Case {
    if (typeof cont == "function") {
      return new MerkleizedCase(this, cont());
    } else {
      return new NormalCase(this, cont);
    }
  }
}

class NotifyAction extends Action {
  observation: Observation;
  constructor(observation: ObservationOrBool) {
    super();
    this.observation = boolToConstant(observation);
  }
  match() {
    return false;
  }
  toJSON() {
    return {
      notify_if: this.observation,
    };
  }
}

export function Notify(observation: ObservationOrBool) {
  return new NotifyAction(observation);
}

class DepositAction extends Action {
  constructor(
    public intoAccount: Party,
    public from: Party,
    public token: Token,
    public value: Value
  ) {
    super();
  }
  match() {
    return false;
  }
  toJSON() {
    return {
      deposits: this.value,
      into_account: this.intoAccount,
      of_token: this.token,
      party: this.from,
    };
  }
}

export class ChoiceAction extends Action {
  match(input: String): boolean {
    throw new Error("Method not implemented.");
  }
  constructor(
    public choiceId: ChoiceId,
    public bounds: Bound[]
  ) {
    super();
  }
  value() {
    return new ChoiceValueValue(this.choiceId);
  }
  toJSON() {
    return {
      for_choice: this.choiceId,
      choose_between: this.bounds,
    };
  }
}
export type Choice = { choiceName: string; bounds: Bound[] };

export function choice(choiceName: string) {
  return {
    between(...bounds: Bound[]): Choice {
      return { choiceName, bounds };
    },
  };
}
class WhenC extends Contract {
  private _continuations = new Map<string, Contract>();
  private contingency: Contingency | undefined;
  constructor(private cases: Case[]) {
    super();
  }
  __build() {
    if (this.built) {
      return;
    }
    this.built = true;

    this.cases.forEach((cs) => {
      if (typeof cs.defaultContingency === "undefined") {
        cs.defaultContingency = this.defaultContingency;
      }
      cs.__build();
    });
    if (this.contingency) {
      this.contingency[1].defaultContingency = this.defaultContingency;
    }

    this.cases.forEach((cse) => {
      return cse.continuations.forEach((cont, hsh) =>
        this._continuations.set(hsh, cont)
      );
    });
    const contingency =
      this.contingency || this.defaultContingency || defaultContingency;
    contingency[1].__build();
    contingency[1].continuations.forEach((cont, hsh) =>
      this._continuations.set(hsh, cont)
    );
  }
  get continuations() {
    this.__build();
    return this._continuations;
  }
  after(deadline: Date, cont: Contract) {
    if (this.built) {
      throw new Error("Cant modify a contract after is built");
    }
    this.contingency = [deadline, cont];
    return this as Contract;
  }
  protected reduceContractStep(
    env: Environment,
    state: State
  ): ReduceStepResult {
    const contingency =
      this.contingency || this.defaultContingency || defaultContingency;

    if (env.timeInterval.to < contingency[0]) {
      return { reduceEffect: "notReduced" };
    } else if (contingency[0] <= env.timeInterval.from) {
      return { reduceEffect: "reduced", state, cont: contingency[1] };
    } else {
      return { errorType: "AmbiguousTimeInterval" };
    }
  }
  toJSON() {
    this.__build();
    const contingency =
      this.contingency || this.defaultContingency || defaultContingency;

    return {
      when: this.cases,
      timeout: contingency[0].getTime(),
      timeout_continuation: contingency[1],
    };
  }
}

export function waitFor(action: Action) {
  return {
    then: (cont: Contract) => {
      return new WhenC([action.then(cont)]);
    },
    after: (deadline: Date, deadlineCont: Contract) => ({
      then: (cont: Contract) => {
        return new WhenC([action.then(cont)]).after(deadline, deadlineCont);
      },
    }),
  };
}

export function waitUntil(deadline: Date) {
  return {
    then: (cont: Contract) => new WhenC([]).after(deadline, cont),
  };
}

type ContingencySetter<T> = {
  after: (timeout: Date, timeoutContract: Contract) => T;
};

export function SetContingency(scope: Contract): ContingencySetter<Contract>;
export function SetContingency(
  scope: ThenableContract
): ContingencySetter<ThenableContract>;
export function SetContingency(scope: Contract | ThenableContract) {
  return {
    after: (timeout: Date, timeoutContract: Contract) => {
      if ("then" in scope) {
        return {
          then: (cont: Contract) => {
            const finalCont = scope.then(cont);
            finalCont.defaultContingency = [timeout, timeoutContract];
            return finalCont;
          },
        };
      } else {
        scope.defaultContingency = [timeout, timeoutContract];
        return scope;
      }
    },
  };
}

export const Close = new CloseC();
export const Pay = (
  from: Party,
  to: Payee,
  token: Token,
  value: ValueOrNumber,
  cont: Contract
) => new PayC(from, to, token, value, cont);
// TODO: Maybe add overrides for IfElse
export function If(obs: ObservationOrBool): {
  then: (c: Contract) => { else: (c: Contract) => Contract };
};
export function If(
  obs: ObservationOrBool,
  ifTrue: Contract,
  ifFalse: Contract
): Contract;
export function If(obs: ObservationOrBool, ...args: any[]): any {
  if (args.length == 0) {
    return {
      then: (ifTrue: Contract) => ({
        else: (ifFalse: Contract) => new IfC(obs, ifTrue, ifFalse),
      }),
    };
  } else {
    return new IfC(obs, args[0], args[1]);
  }
}

export const When = (cases: Case[]) => new WhenC(cases);
export function Deposit(
  intoAccount: Party,
  from: Party,
  token: Token,
  value: ValueOrNumber
) {
  return new DepositAction(intoAccount, from, token, numberToConstant(value));
}

export class TimeInterval {
  constructor(
    public from: Date,
    public to: Date
  ) {
    if (from.getTime() > to.getTime()) {
      throw new Error("Invalid time interval");
    }
  }
  toJSON() {
    return { from: this.from.getTime(), to: this.to.getTime() };
  }
}

export class Environment {
  constructor(public timeInterval: TimeInterval) {}
  toJSON() {
    return { timeInterval: this.timeInterval };
  }
}

export class Accounts {
  private accs: Map<string, [Party, Token, bigint]>;
  constructor(accs: Array<[Party, Token, bigint]> = []) {
    this.accs = new Map();
    accs.forEach(([party, token, value]) => {
      if (value <= 0) {
        this.accs.delete(this.key(party, token));
      } else {
        this.accs.set(this.key(party, token), [party, token, value]);
      }
    });
  }
  private key(party: Party, token: Token) {
    return sha1({ party, token });
  }
  availableMoney(party: Party, token: Token) {
    return this.accs.get(this.key(party, token))?.[2] ?? 0n;
  }
  set(party: Party, token: Token, value: bigint) {
    return new Accounts([...this.accs.values(), [party, token, value]]);
  }
  values() {
    return [...this.accs.values()];
  }
}

function choiceIdKey(choiceId: ChoiceId) {
  return sha1(choiceId);
}

export class State {
  constructor(
    public accounts: Accounts,
    public choices: Map<string, bigint>,
    public boundValues: Map<string, bigint>,
    public minTime: Date
  ) {}
  updateAccounts(accounts: Accounts) {
    return new State(accounts, this.choices, this.boundValues, this.minTime);
  }
  toJSON() {
    // TODO: implement
    return {
      accounts: [],
      choices: [],
      boundValues: [],
      minTime: this.minTime.getTime(),
    };
  }
}

export function emptyState(minTime: Date) {
  return new State(new Accounts(), new Map(), new Map(), minTime);
}

type ThenableContract = {
  then: (cont: Contract) => Contract;
};

type DoableContract = [...ThenableContract[], Contract];

export function Do(...chain: DoableContract) {
  const cont = chain.at(chain.length - 1) as Contract;
  const firstPart = chain.slice(0, chain.length - 1) as ThenableContract[];
  return firstPart.reduceRight((prev: Contract, curr) => curr.then(prev), cont);
}

export function Chain(...chain: ThenableContract[]): ThenableContract {
  return {
    then: (cont: Contract) => Do(...chain, cont),
  };
}

export function All(actions: Action[], cont: Contract): Case[] {
  if (actions.length == 0) {
    return [];
  } else if (actions.length == 1) {
    return [actions[0].then(() => cont)];
  } else {
    return actions.flatMap((action, index) => {
      return action.then(() => {
        const c = When(
          All(actions.slice(0, index).concat(actions.slice(index + 1)), cont)
        );
        c.defaultContingency = cont.defaultContingency;
        return c;
      });
    });
  }
}

export function Seq(actions: Action[], cont: Contract): Case[] {
  if (actions.length == 0) {
    return [];
  } else if (actions.length == 1) {
    return [actions[0].then(() => cont)];
  } else {
    return [
      actions[0].then(() => {
        const c = When(Seq(actions.slice(1), cont));
        c.defaultContingency = cont.defaultContingency;
        return c;
      }),
    ];
  }
}

export function Any(actions: Action[], cont: Contract): Case[] {
  return actions.map((a) => a.then(cont));
}
