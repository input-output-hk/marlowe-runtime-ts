import { sha1 } from "object-hash";
import jsonBigInt from "json-bigint";
import {
  BundleMap,
  mergeBundleMaps,
} from "@marlowe.io/marlowe-object/bundle-map";
import * as Obj from "@marlowe.io/marlowe-object";
// FIXME: Remove this circular dependency by splitting the responsability of
//        building the Contract object and the serialization.
import { ContractGuard } from "./guards.js";

export type ThenableContract = {
  then: (cont: Contract) => Contract;
};

export type DoableContract = [...ThenableContract[], Contract];

type IntoAccount = {
  intoAccount: (to: Party) => DepositAction;
  intoOwnAccount: () => DepositAction;
};
type ChoiceBetween = { between: (...bounds: Bound[]) => ChoiceAction };
type PayTo = { to: (dst: Party) => ThenableContract };

// #region Party
export abstract class Party {
  deposits(asset: SingleAssetValue): IntoAccount;
  deposits(value: ValueOrNumber, token: Token): IntoAccount;
  deposits(...args: [SingleAssetValue] | [ValueOrNumber, Token]): IntoAccount {
    const from = this;
    const tok = args.length == 1 ? args[0][1] : args[1];
    const val = args.length == 1 ? args[0][0] : args[0];
    return {
      intoAccount: (to: Party) => {
        return new DepositAction(to, from, tok, numberToConstant(val));
      },
      intoOwnAccount: () => {
        return new DepositAction(from, from, tok, numberToConstant(val));
      },
    };
  }

  chooses(choice: Choice): ChoiceAction;
  chooses(choiceName: string): ChoiceBetween;
  chooses(arg: string | Choice) {
    if (typeof arg === "string") {
      return {
        between: (...bounds: Bound[]) =>
          new ChoiceAction(new ChoiceId(arg, this), bounds),
      };
    } else {
      return new ChoiceAction(new ChoiceId(arg.choiceName, this), arg.bounds);
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
            return new Pay(from, new AccountPayee(dst), tok, val, cont);
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
            return new Pay(from, new PartyPayee(dst), tok, val, cont);
          },
        };
      },
    };
  }
  availableMoney(token: Token) {
    return new AvailableMoneyValue(this, token);
  }
}

export class RoleParty extends Party {
  constructor(public roleName: string) {
    super();
  }
}

export class AddressParty extends Party {
  constructor(public address: string) {
    super();
  }
}

// #endregion Party

// #region Token
export type SingleAssetValue = [ValueOrNumber, Token];
export type SingleAsset = [number, Token];

export class Token {
  constructor(
    public currencySymbol: Readonly<string>,
    public tokenName: Readonly<string>
  ) {}
}

// #endregion Token

// #region Payee
export abstract class Payee {
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

export class PartyPayee extends Payee {
  constructor(public party: Party) {
    super();
  }
}

// TODO: Rename to PayeeAccount to match marlowe-object
export class AccountPayee extends Payee {
  constructor(public account: Party) {
    super();
  }
}

// #endregion Payee

export class ChoiceId {
  constructor(
    public choiceName: string,
    public choiceOwner: Party
  ) {}
  value() {
    return new ChoiceValueValue(this);
  }
}

export type Bound = Obj.Bound;

export abstract class Value {
  abstract eval(env: Environment, state: State): bigint;

  neg() {
    return new NegValue(this);
  }

  add(right: ValueOrNumber) {
    return new AddValue(this, right);
  }

  sub(right: ValueOrNumber) {
    return new SubValue(this, right);
  }

  mul(right: ValueOrNumber) {
    return new MulValue(this, right);
  }

  div(by: ValueOrNumber) {
    return new DivValue(this, by);
  }

  eq(right: ValueOrNumber) {
    return new ValueEq(this, right);
  }
  greaterOrEqual(right: ValueOrNumber) {
    return new ValueGEObs(this, right);
  }
  greaterThan(right: ValueOrNumber) {
    return new ValueGTObs(this, right);
  }

  lowerThan(right: ValueOrNumber) {
    return new ValueLTObs(this, right);
  }
}

export type ValueOrNumber = Value | number | bigint;

export const numberToConstant = (val: ValueOrNumber): Value => {
  if (typeof val == "number") {
    return new ConstantValue(BigInt(val));
  } else if (typeof val == "bigint") {
    return new ConstantValue(val);
  } else return val;
};

export class AvailableMoneyValue extends Value {
  constructor(
    public accountId: Party,
    public token: Token
  ) {
    super();
  }
  eval(env: Environment, state: State) {
    return state.accounts.availableMoney(this.accountId, this.token);
  }
}

export class ChoiceValueValue extends Value {
  constructor(public choiceId: ChoiceId) {
    super();
  }
  eval(env: Environment, state: State) {
    return state.choices.get(choiceIdKey(this.choiceId)) ?? 0n;
  }
}

export class ConstantValue extends Value {
  constructor(public val: bigint) {
    super();
  }
  eval() {
    return this.val;
  }
}

export class NegValue extends Value {
  val: Value;
  constructor(val: ValueOrNumber) {
    super();
    this.val = numberToConstant(val);
  }
  eval(env: Environment, state: State) {
    return -this.val.eval(env, state);
  }
}

export class AddValue extends Value {
  left: Value;
  right: Value;
  constructor(left: ValueOrNumber, right: ValueOrNumber) {
    super();
    this.left = numberToConstant(left);
    this.right = numberToConstant(right);
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) + this.right.eval(env, state);
  }
}

export class SubValue extends Value {
  left: Value;
  right: Value;
  constructor(left: ValueOrNumber, right: ValueOrNumber) {
    super();
    this.left = numberToConstant(left);
    this.right = numberToConstant(right);
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) - this.right.eval(env, state);
  }
}

export class MulValue extends Value {
  left: Value;
  right: Value;
  constructor(left: ValueOrNumber, right: ValueOrNumber) {
    super();
    this.left = numberToConstant(left);
    this.right = numberToConstant(right);
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) * this.right.eval(env, state);
  }
}

export class DivValue extends Value {
  divide: Value;
  by: Value;
  constructor(divide: ValueOrNumber, by: ValueOrNumber) {
    super();
    this.divide = numberToConstant(divide);
    this.by = numberToConstant(by);
  }
  eval(env: Environment, state: State) {
    return this.divide.eval(env, state) / this.by.eval(env, state);
  }
}

export type ValueId = string;

export class UseValue extends Value {
  constructor(public valueId: ValueId) {
    super();
  }
  eval(env: Environment, state: State) {
    return state.boundValues.get(this.valueId) ?? 0n;
  }
}

export class CondValue extends Value {
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
}

export class TimeIntervalStartValue extends Value {
  eval(env: Environment, _: State) {
    return BigInt(env.timeInterval.from.getTime());
  }
}

export class TimeIntervalEndValue extends Value {
  eval(env: Environment, _: State) {
    return BigInt(env.timeInterval.to.getTime());
  }
}

export abstract class Observation {
  abstract eval(env: Environment, state: State): boolean;
  and(right: Observation) {
    return new AndObs(this, right);
  }
  or(right: Observation) {
    return new OrObs(this, right);
  }
  not() {
    return new NotObs(this);
  }
}

export class AndObs extends Observation {
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
}

export class OrObs extends Observation {
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
}

export class NotObs extends Observation {
  val: Observation;
  constructor(val: ObservationOrBool) {
    super();
    this.val = boolToConstant(val);
  }
  eval(env: Environment, state: State) {
    return !this.val.eval(env, state);
  }
}

export class ValueEq extends Observation {
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
}

export class ValueGEObs extends Observation {
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
}

export class ValueGTObs extends Observation {
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
}

export class ValueLTObs extends Observation {
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
}

export class ValueLEObs extends Observation {
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
}

export class ChoseSomething extends Observation {
  constructor(public choiceId: ChoiceId) {
    super();
  }
  eval(env: Environment, state: State) {
    return state.choices.has(choiceIdKey(this.choiceId));
  }
}

export class ConstantObs extends Observation {
  constructor(public obs: boolean) {
    super();
  }
  eval() {
    return this.obs;
  }
  toJSON() {
    return this.obs;
  }
}

export type ObservationOrBool = Observation | boolean;

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
  abstract get bundleMap(): Readonly<BundleMap<unknown>>;
  abstract reduceContractStep(env: Environment, state: State): ReduceStepResult;

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
  // FIXME: Rename
  getRuntimeObject(): Obj.ContractBundleMap<unknown> {
    const objects = mergeBundleMaps(this.bundleMap, {
      [this.hash()]: {
        type: "contract",
        value: ContractGuard.encode(this),
      },
    });
    return { objects, main: this.hash() };
  }
  do(...chain: DoableContract) {
    return Do(...chain);
  }
  isClose() {
    return this instanceof Close;
  }
  isPay() {
    return this instanceof Pay;
  }
  hash() {
    this.__build();
    return sha1(ContractGuard.encode(this));
  }
}

export class Close extends Contract {
  __build() {}
  get bundleMap() {
    return {};
  }
  reduceContractStep(_: Environment, state: State): ReduceStepResult {
    const accs = state.accounts.values();
    if (accs.length == 0) {
      return { reduceEffect: "notReduced" };
    } else {
      const [refund, ...newAccs] = accs;
      const payment = {
        payment_from: refund[0],
        to: new PartyPayee(refund[0]),
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
}

function bigIntMin(...val: bigint[]) {
  let min = val[0];
  val.forEach((n) => (min = n < min ? n : min));
  return min;
}

export class Pay extends Contract {
  value: Value;
  private _bundleMap?: BundleMap<unknown>;
  constructor(
    public from: Party,
    public to: Payee,
    public token: Token,
    value: ValueOrNumber,
    public cont: Contract
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
    this._bundleMap = this.cont.bundleMap;
  }
  reduceContractStep(env: Environment, state: State): ReduceStepResult {
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
  get bundleMap() {
    this.__build();
    if (!this._bundleMap) {
      throw new Error("Bundle map not initialized");
    }
    return this._bundleMap;
  }
}

export class Assert extends Contract {
  __build(): void {
    if (this.built) {
      return;
    }
    this.built = true;
    if (typeof this.cont.defaultContingency == "undefined") {
      this.cont.defaultContingency = this.defaultContingency;
    }
    this.cont.__build();
    this._bundleMap = this.cont.bundleMap;
  }
  private _bundleMap?: BundleMap<unknown>;

  get bundleMap() {
    this.__build();
    if (!this._bundleMap) {
      throw new Error("Bundle map not initialized");
    }
    return this._bundleMap;
  }
  reduceContractStep(env: Environment, state: State): ReduceStepResult {
    throw new Error("Method not implemented.");
  }
  constructor(
    public obs: Observation,
    public cont: Contract
  ) {
    super();
  }
}

export class Let extends Contract {
  private _bundleMap?: BundleMap<unknown>;

  get bundleMap() {
    this.__build();
    if (!this._bundleMap) {
      throw new Error("Bundle map not initialized");
    }
    return this._bundleMap;
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
    this._bundleMap = this.cont.bundleMap;
  }

  reduceContractStep(env: Environment, state: State): ReduceStepResult {
    throw new Error("Method not implemented.");
  }
  constructor(
    public valueId: string,
    public value: Value,
    public cont: Contract
  ) {
    super();
  }
}

export class If extends Contract {
  private _bundleMap?: BundleMap<unknown>;
  public obs: Observation;
  constructor(
    obs: ObservationOrBool,
    public ifTrue: Contract,
    public ifFalse: Contract
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
    this._bundleMap = mergeBundleMaps(
      this.ifTrue.bundleMap,
      this.ifFalse.bundleMap
    );
  }
  get bundleMap() {
    this.__build();
    if (!this._bundleMap) {
      throw new Error("Bundle map not initialized");
    }
    return this._bundleMap;
  }

  reduceContractStep(env: Environment, state: State): ReduceStepResult {
    const cont = this.obs.eval(env, state) ? this.ifTrue : this.ifFalse;
    return { reduceEffect: "reduced", state, cont };
  }
}

export type Contingency = [Date, Contract];

export const defaultContingency = [new Date(0), new Close()] as Contingency;

// TODO: Implement
type Input = String;

export abstract class Case {
  protected built = false;
  abstract __build(): void;
  defaultContingency: Contingency | undefined;
  abstract bundleMap: BundleMap<unknown>;
}

export class NormalCase extends Case {
  private _bundleMap?: BundleMap<unknown>;
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
    this._bundleMap = this.cont.bundleMap;
  }
  get bundleMap() {
    this.__build();
    if (!this._bundleMap) {
      throw new Error("Bundle map not initialized");
    }
    return this._bundleMap;
  }
}

export class RefContract extends Contract {
  private _label?: string;
  constructor(
    public ref: Contract,
    label?: string
  ) {
    super();
    this._label = label;
  }
  get label() {
    if (!this._label) {
      this.__build();
      this._label = this.ref.hash();
    }
    return this._label;
  }

  __build(): void {
    if (this.built) {
      return;
    }
    this.built = true;

    if (typeof this.ref.defaultContingency == "undefined") {
      this.ref.defaultContingency = this.defaultContingency;
    }
    this.ref.__build();
    const label = this._label || this.ref.hash();

    this._bundleMap = mergeBundleMaps(this.ref.bundleMap, {
      [label]: {
        type: "contract",
        value: ContractGuard.encode(this.ref),
      },
    });
  }
  private _bundleMap?: BundleMap<unknown>;
  get bundleMap(): Readonly<BundleMap<unknown>> {
    this.__build();
    if (!this._bundleMap) {
      throw new Error("Bundle map not initialized");
    }
    return this._bundleMap;
  }
  reduceContractStep(env: Environment, state: State): ReduceStepResult {
    return this.ref.reduceContractStep(env, state);
  }
}

export abstract class Action {
  // FIXME: Remove
  abstract match(input: Input): boolean;
  then(cont: Contract): Case {
    return new NormalCase(this, cont);
  }
}

export class NotifyAction extends Action {
  observation: Observation;
  constructor(observation: ObservationOrBool) {
    super();
    this.observation = boolToConstant(observation);
  }
  match() {
    return false;
  }
}

export class DepositAction extends Action {
  value: Value;
  constructor(
    public intoAccount: Party,
    public from: Party,
    public token: Token,
    value: ValueOrNumber
  ) {
    super();
    this.value = numberToConstant(value);
  }
  match() {
    return false;
  }
}

// TODO: Rename to Choice
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
}

// TODO: Revisit this, why Choice and not ChoiceAction
export type Choice = { choiceName: string; bounds: Bound[] };

export function choice(choiceName: string) {
  return {
    between(...bounds: Bound[]): Choice {
      return { choiceName, bounds };
    },
  };
}
export class When extends Contract {
  private _bundleMap: BundleMap<unknown>;
  public contingency: Contingency | undefined;
  constructor(public cases: Case[]) {
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

    const contingency =
      this.contingency || this.defaultContingency || defaultContingency;
    contingency[1].__build();

    this._bundleMap = [
      contingency[1].bundleMap,
      ...this.cases.map((cse) => cse.bundleMap),
    ].reduce(mergeBundleMaps, {});
    // this.cases.forEach((cse) => {
    //   return cse.bundleMap.forEach((cont, hsh) =>
    //     this._bundleMap.set(hsh, cont)
    //   );
    // });
    // contingency[1].bundleMap.forEach((cont, hsh) =>
    //   this._bundleMap.set(hsh, cont)
    // );
  }
  get bundleMap() {
    this.__build();
    return this._bundleMap;
  }
  after(deadline: Date, cont: Contract) {
    if (this.built) {
      throw new Error("Cant modify a contract after is built");
    }
    this.contingency = [deadline, cont];
    return this as Contract;
  }
  reduceContractStep(env: Environment, state: State): ReduceStepResult {
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
  // TODO: Delete
  // toJSON() {
  //   this.__build();
  //   const contingency =
  //     this.contingency || this.defaultContingency || defaultContingency;

  //   return {
  //     when: this.cases,
  //     timeout: contingency[0].getTime(),
  //     timeout_continuation: contingency[1],
  //   };
  // }
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

export function Do(...chain: DoableContract) {
  const cont = chain.at(chain.length - 1) as Contract;
  const firstPart = chain.slice(0, chain.length - 1) as ThenableContract[];
  return firstPart.reduceRight((prev: Contract, curr) => curr.then(prev), cont);
}
