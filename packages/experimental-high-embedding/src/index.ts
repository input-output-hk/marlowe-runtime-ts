import { sha1 } from "object-hash";
import * as t from "io-ts/lib/index.js";
import * as Either from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import jsonBigInt from "json-bigint";
import {
  BundleMap,
  mergeBundleMaps,
} from "@marlowe.io/marlowe-object/bundle-map";
import * as ObjG from "@marlowe.io/marlowe-object/guards";
import * as Obj from "@marlowe.io/marlowe-object";
import { unsafeEither } from "@marlowe.io/adapter/fp-ts";
import { subtypeUnion } from "@marlowe.io/adapter/io-ts";

type IntoAccount = {
  intoAccount: (to: Party) => DepositAction;
  intoOwnAccount: () => DepositAction;
};
type ChoiceBetween = { between: (...bounds: Bound[]) => ChoiceAction };
type PayTo = { to: (dst: Party) => ThenableContract };

// #region Party
export abstract class Party {
  static parse(obj: unknown): Party {
    return unsafeEither(PartyGuard.decode(obj));
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
    if (typeof arg === "string") {
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

export const RoleGuard = ObjG.Role.pipe(
  new t.Type<RoleParty, Obj.Role, Obj.Role>(
    "RoleFromObject",
    (u): u is RoleParty => u instanceof RoleParty,
    (u, c) => {
      return t.success(new RoleParty(u.role_token));
    },
    (a) => ({ role_token: a.roleName })
  )
);

class RoleParty extends Party {
  constructor(public roleName: string) {
    super();
  }
}

export function Role(roleName: string) {
  return new RoleParty(roleName);
}

class AddressParty extends Party {
  constructor(public address: string) {
    super();
  }
}

export function Address(address: string) {
  return new AddressParty(address);
}

export const AddressGuard = ObjG.Address.pipe(
  new t.Type<AddressParty, Obj.Address, Obj.Address>(
    "AddressFromObject",
    (u): u is AddressParty => u instanceof AddressParty,
    (u, c) => {
      return t.success(new AddressParty(u.address));
    },
    (a) => ({ address: a.address })
  )
);

export const PartyGuard = subtypeUnion("Party", Party, [
  AddressGuard,
  RoleGuard,
]);

// #endregion Party

// #region Token
export type SingleAssetValue = [ValueOrNumber, Token];
export type SingleAsset = [number, Token];

export class Token {
  constructor(
    public currencySymbol: Readonly<string>,
    public tokenName: Readonly<string>
  ) {}
  static parse(obj: unknown): Token {
    return unsafeEither(TokenGuard.decode(obj));
  }
}

export function token(currencySymbol: string, tokenName: string): Token {
  return new Token(currencySymbol, tokenName);
}

export const lovelace = token("", "");

export const TokenGuard = ObjG.Token.pipe(
  new t.Type<Token, Obj.Token, Obj.Token>(
    "TokenFromObject",
    (u): u is Token => u instanceof Token,
    (u, c) => {
      if ("currency_symbol" in u) {
        return t.success(new Token(u.currency_symbol, u.token_name));
      } else {
        return t.failure<Token>(
          u,
          c,
          "Token reference decoding is not implemented. "
        );
      }
    },
    (a) => ({ currency_symbol: a.currencySymbol, token_name: a.tokenName })
  )
);
// #endregion Token

// #region Payee
export abstract class Payee {
  static parse(obj: unknown): Payee {
    return unsafeEither(PayeeGuard.decode(obj));
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
}

export const PartyPayeeGuard = ObjG.PayeeParty.pipe(
  new t.Type<PartyPayee, Obj.PayeeParty, Obj.PayeeParty>(
    "PartyPayeeFromObject",
    (u): u is PartyPayee => u instanceof PartyPayee,
    (u, c) =>
      pipe(
        PartyGuard.validate(u.party, c),
        Either.map((party) => new PartyPayee(party))
      ),
    (a) => ({ party: PartyGuard.encode(a.party) })
  )
);

// TODO: Rename to PayeeAccount to match marlowe-object
class AccountPayee extends Payee {
  constructor(public account: Party) {
    super();
  }
}

export const AccountPayeeGuard = ObjG.PayeeAccount.pipe(
  new t.Type<AccountPayee, Obj.PayeeAccount, Obj.PayeeAccount>(
    "AccountFromObject",
    (u): u is AccountPayee => u instanceof AccountPayee,
    (u, c) => {
      return pipe(
        PartyGuard.validate(u.account, c),
        Either.map((account) => new AccountPayee(account))
      );
    },
    (a) => ({ account: PartyGuard.encode(a.account) })
  )
);

export function account(p: Party) {
  return new AccountPayee(p);
}

export function party(p: Party) {
  return new PartyPayee(p);
}

export const PayeeGuard = subtypeUnion("Payee", Payee, [
  AccountPayeeGuard,
  PartyPayeeGuard,
]);

// #endregion Payee

export class ChoiceId {
  constructor(
    public choiceName: string,
    public choiceOwner: Party
  ) {}
  value() {
    return new ChoiceValueValue(this);
  }
  static parse(val: unknown): ChoiceId {
    return unsafeEither(ChoiceIdGuard.decode(val));
  }
}

export const ChoiceIdGuard = ObjG.ChoiceId.pipe(
  new t.Type<ChoiceId, Obj.ChoiceId, Obj.ChoiceId>(
    "ChoiceIdFromObject",
    (u): u is ChoiceId => u instanceof ChoiceId,
    (u, ctx) => {
      return pipe(
        PartyGuard.validate(u.choice_owner, ctx),
        Either.map((party) => new ChoiceId(u.choice_name, party))
      );
    },
    (a) => ({
      choice_name: a.choiceName,
      choice_owner: PartyGuard.encode(a.choiceOwner),
    })
  )
);

export function choiceId(choiceName: string, choiceOwner: Party): ChoiceId {
  return new ChoiceId(choiceName, choiceOwner);
}
// TODO refactor to bigint
export type Bound = Obj.Bound;
export function Bound(from: bigint, to: bigint): Bound {
  return { from, to };
}

Bound.parse = function (val: unknown): Bound {
  return unsafeEither(BoundGuard.decode(val));
};

export const BoundGuard = ObjG.Bound;

export abstract class Value {
  static parse(val: unknown): Value {
    return unsafeEither(ValueGuard.decode(val));
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

export const AvailableMoneyGuard = ObjG.AvailableMoney.pipe(
  new t.Type<AvailableMoneyValue, Obj.AvailableMoney, Obj.AvailableMoney>(
    "AvailableMoneyFromObject",
    (u): u is AvailableMoneyValue => u instanceof AvailableMoneyValue,
    (u, c) =>
      pipe(
        Either.Do,
        Either.apS("in_account", PartyGuard.validate(u.in_account, c)),
        Either.apS(
          "amount_of_token",
          TokenGuard.validate(u.amount_of_token, c)
        ),
        Either.map(
          (party) =>
            new AvailableMoneyValue(party.in_account, party.amount_of_token)
        )
      ),
    (a) => ({
      amount_of_token: TokenGuard.encode(a.token),
      in_account: PartyGuard.encode(a.accountId),
    })
  )
);

export class ChoiceValueValue extends Value {
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

export const ChoiceValueGuard = ObjG.ChoiceValue.pipe(
  new t.Type<ChoiceValueValue, Obj.ChoiceValue, Obj.ChoiceValue>(
    "ChoiceValueFromObject",
    (u): u is ChoiceValueValue => u instanceof ChoiceValueValue,
    (u, c) =>
      pipe(
        ChoiceIdGuard.validate(u.value_of_choice, c),
        Either.map((choiceId) => new ChoiceValueValue(choiceId))
      ),
    (a) => ({ value_of_choice: ChoiceIdGuard.encode(a.choiceId) })
  )
);

export function AvailableMoney(accountId: Party, token: Token) {
  return new AvailableMoneyValue(accountId, token);
}

export class ConstantValue extends Value {
  constructor(public val: bigint) {
    super();
  }
  eval() {
    return this.val;
  }
}

export function Constant(n: number | bigint) {
  return new ConstantValue(BigInt(n));
}

export const ConstantGuard = ObjG.Constant.pipe(
  new t.Type<ConstantValue, Obj.Constant, Obj.Constant>(
    "ConstantFromObject",
    (u): u is ConstantValue => u instanceof ConstantValue,
    (u, c) => {
      return t.success(new ConstantValue(u));
    },
    (a) => a.val
  )
);

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

export const NegGuard = ObjG.NegValue.pipe(
  new t.Type<NegValue, Obj.NegValue, Obj.NegValue>(
    "NegValueFromObject",
    (u): u is NegValue => u instanceof NegValue,
    (u, ctx) => {
      return pipe(
        ValueGuard.validate(u.negate, ctx),
        Either.map((val) => new NegValue(val))
      );
    },
    (a) => ({ negate: ValueGuard.encode(a.val) })
  )
);

export function Neg(val: ValueOrNumber) {
  return new NegValue(val);
}

export class AddValue extends Value {
  constructor(
    public left: Value,
    public right: Value
  ) {
    super();
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) + this.right.eval(env, state);
  }
}

export const AddGuard = ObjG.AddValue.pipe(
  new t.Type<AddValue, Obj.AddValue, Obj.AddValue>(
    "AddValueFromObject",
    (u): u is AddValue => u instanceof AddValue,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("add", ValueGuard.validate(u.add, ctx)),
        Either.apS("and", ValueGuard.validate(u.and, ctx)),
        Either.map((val) => new AddValue(val.add, val.and))
      ),
    (a) => ({ add: ValueGuard.encode(a.left), and: ValueGuard.encode(a.right) })
  )
);

export function Add(left: ValueOrNumber, right: ValueOrNumber) {
  return new AddValue(numberToConstant(left), numberToConstant(right));
}

export class SubValue extends Value {
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
}

export const SubValueGuard = ObjG.SubValue.pipe(
  new t.Type<SubValue, Obj.SubValue, Obj.SubValue>(
    "SubValueFromObject",
    (u): u is SubValue => u instanceof SubValue,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("minus", ValueGuard.validate(u.minus, ctx)),
        Either.map((val) => new SubValue(val.value, val.minus))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      minus: ValueGuard.encode(a.right),
    })
  )
);

export function Sub(left: ValueOrNumber, right: ValueOrNumber) {
  return new SubValue(numberToConstant(left), numberToConstant(right));
}

export class MulValue extends Value {
  constructor(
    public left: Value,
    public right: Value
  ) {
    super();
  }
  eval(env: Environment, state: State) {
    return this.left.eval(env, state) * this.right.eval(env, state);
  }
}

export const MulValueGuard = ObjG.MulValue.pipe(
  new t.Type<MulValue, Obj.MulValue, Obj.MulValue>(
    "MulValueFromObject",
    (u): u is MulValue => u instanceof MulValue,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("multiply", ValueGuard.validate(u.multiply, ctx)),
        Either.apS("times", ValueGuard.validate(u.times, ctx)),
        Either.map((val) => new MulValue(val.multiply, val.times))
      ),
    (a) => ({
      multiply: ValueGuard.encode(a.left),
      times: ValueGuard.encode(a.right),
    })
  )
);

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
}

export const DivValueGuard = ObjG.DivValue.pipe(
  new t.Type<DivValue, Obj.DivValue, Obj.DivValue>(
    "DivValueFromObject",
    (u): u is DivValue => u instanceof DivValue,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("divide", ValueGuard.validate(u.divide, ctx)),
        Either.apS("by", ValueGuard.validate(u.by, ctx)),
        Either.map((val) => new DivValue(val.divide, val.by))
      ),
    (a) => ({
      divide: ValueGuard.encode(a.divide),
      by: ValueGuard.encode(a.by),
    })
  )
);

export function Div(divide: ValueOrNumber, by: ValueOrNumber) {
  return new DivValue(numberToConstant(divide), numberToConstant(by));
}

type ValueId = string;

class UseValue extends Value {
  constructor(public valueId: ValueId) {
    super();
  }
  eval(env: Environment, state: State) {
    return state.boundValues.get(this.valueId) ?? 0n;
  }
}

export function Use(valueId: ValueId) {
  return new UseValue(valueId);
}

export const UseValueGuard = ObjG.UseValue.pipe(
  new t.Type<UseValue, Obj.UseValue, Obj.UseValue>(
    "UseValueFromObject",
    (u): u is UseValue => u instanceof UseValue,
    (u, ctx) => {
      return t.success(new UseValue(u.use_value));
    },
    (a) => ({ use_value: a.valueId })
  )
);

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

export const CondGuard = ObjG.Cond.pipe(
  new t.Type<CondValue, Obj.Cond, Obj.Cond>(
    "CondFromObject",
    (u): u is CondValue => u instanceof CondValue,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("if", ObservationGuard.validate(u.if, ctx)),
        Either.apS("then", ValueGuard.validate(u.then, ctx)),
        Either.apS("else", ValueGuard.validate(u.else, ctx)),
        Either.map((val) => new CondValue(val.if, val.then, val.else))
      ),
    (a) => ({
      if: ObservationGuard.encode(a.obs),
      then: ValueGuard.encode(a.ifTrue),
      else: ValueGuard.encode(a.ifFalse),
    })
  )
);

export function Cond(
  obs: ObservationOrBool,
  ifTrue: ValueOrNumber,
  ifFalse: ValueOrNumber
) {
  return new CondValue(obs, ifTrue, ifFalse);
}

export class TimeIntervalStartValue extends Value {
  eval(env: Environment, _: State) {
    return BigInt(env.timeInterval.from.getTime());
  }
}

export const TimeIntervalStartGuard = ObjG.TimeIntervalStart.pipe(
  new t.Type<
    TimeIntervalStartValue,
    Obj.TimeIntervalStart,
    Obj.TimeIntervalStart
  >(
    "TimeIntervalStartFromObject",
    (u): u is TimeIntervalStartValue => u instanceof TimeIntervalStartValue,
    (u, ctx) => {
      return t.success(new TimeIntervalStartValue());
    },
    (a) => "time_interval_start"
  )
);

export const TimeIntervalStart = new TimeIntervalStartValue();

class TimeIntervalEndValue extends Value {
  eval(env: Environment, _: State) {
    return BigInt(env.timeInterval.to.getTime());
  }
}

export const TimeIntervalEndGuard = ObjG.TimeIntervalEnd.pipe(
  new t.Type<TimeIntervalEndValue, Obj.TimeIntervalEnd, Obj.TimeIntervalEnd>(
    "TimeIntervalEndFromObject",
    (u): u is TimeIntervalEndValue => u instanceof TimeIntervalEndValue,
    (u, ctx) => {
      return t.success(new TimeIntervalEndValue());
    },
    (a) => "time_interval_end"
  )
);

export const ValueGuard: t.Type<Value, Obj.Value, unknown> = t.recursion(
  "Value",
  () =>
    subtypeUnion("Value", Value, [
      ConstantGuard,
      AvailableMoneyGuard,
      ChoiceValueGuard,
      NegGuard,
      AddGuard,
      SubValueGuard,
      MulValueGuard,
      DivValueGuard,
      UseValueGuard,
      CondGuard,
      TimeIntervalStartGuard,
      TimeIntervalEndGuard,
    ])
);

export const TimeIntervalEnd = new TimeIntervalEndValue();

export function Max(a: Value, b: Value): Value {
  return Cond(a.greaterThan(b), a, b);
}
export function Min(a: Value, b: Value): Value {
  return Cond(a.lowerThan(b), a, b);
}

export abstract class Observation {
  static parse(val: unknown): Observation {
    return unsafeEither(ObservationGuard.decode(val));
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

export const AndObsGuard = ObjG.AndObs.pipe(
  new t.Type<AndObs, Obj.AndObs, Obj.AndObs>(
    "AndObsFromObject",
    (u): u is AndObs => u instanceof AndObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("both", ObservationGuard.validate(u.both, ctx)),
        Either.apS("and", ObservationGuard.validate(u.and, ctx)),
        Either.map((val) => new AndObs(val.both, val.and))
      ),
    (a) => ({
      both: ObservationGuard.encode(a.left),
      and: ObservationGuard.encode(a.right),
    })
  )
);

export function And(left: ObservationOrBool, right: ObservationOrBool) {
  return new AndObs(left, right);
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
export const OrObsGuard = ObjG.OrObs.pipe(
  new t.Type<OrObs, Obj.OrObs, Obj.OrObs>(
    "OrObsFromObject",
    (u): u is OrObs => u instanceof OrObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("either", ObservationGuard.validate(u.either, ctx)),
        Either.apS("or", ObservationGuard.validate(u.or, ctx)),
        Either.map((val) => new OrObs(val.either, val.or))
      ),
    (a) => ({
      either: ObservationGuard.encode(a.left),
      or: ObservationGuard.encode(a.right),
    })
  )
);

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
}

export const NotObsGuard = ObjG.NotObs.pipe(
  new t.Type<NotObs, Obj.NotObs, Obj.NotObs>(
    "NotObsFromObject",
    (u): u is NotObs => u instanceof NotObs,
    (u, ctx) =>
      pipe(
        ObservationGuard.validate(u.not, ctx),
        Either.map((val) => new NotObs(val))
      ),
    (a) => ({ not: ObservationGuard.encode(a.val) })
  )
);

export function Not(val: ObservationOrBool) {
  return new NotObs(val);
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

export const ValueEqGuard = ObjG.ValueEQ.pipe(
  new t.Type<ValueEq, Obj.ValueEQ, Obj.ValueEQ>(
    "ValueEqFromObject",
    (u): u is ValueEq => u instanceof ValueEq,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("equal_to", ValueGuard.validate(u.equal_to, ctx)),
        Either.map((val) => new ValueEq(val.value, val.equal_to))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      equal_to: ValueGuard.encode(a.right),
    })
  )
);

export function Eq(left: ValueOrNumber, right: ValueOrNumber) {
  return new ValueEq(left, right);
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

export const ValueGEObsGuard = ObjG.ValueGE.pipe(
  new t.Type<ValueGEObs, Obj.ValueGE, Obj.ValueGE>(
    "ValueGEFromObject",
    (u): u is ValueGEObs => u instanceof ValueGEObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("ge_than", ValueGuard.validate(u.ge_than, ctx)),
        Either.map((val) => new ValueGEObs(val.value, val.ge_than))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      ge_than: ValueGuard.encode(a.right),
    })
  )
);

export function ValueGE(left: ValueOrNumber, right: ValueOrNumber) {
  return new ValueGEObs(left, right);
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

export const ValueGTObsGuard = ObjG.ValueGT.pipe(
  new t.Type<ValueGTObs, Obj.ValueGT, Obj.ValueGT>(
    "ValueGTFromObject",
    (u): u is ValueGTObs => u instanceof ValueGTObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("gt", ValueGuard.validate(u.gt, ctx)),
        Either.map((val) => new ValueGTObs(val.value, val.gt))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      gt: ValueGuard.encode(a.right),
    })
  )
);

export function ValueGT(left: ValueOrNumber, right: ValueOrNumber) {
  return new ValueGTObs(left, right);
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

export const ValueLTObsGuard = ObjG.ValueLT.pipe(
  new t.Type<ValueLTObs, Obj.ValueLT, Obj.ValueLT>(
    "ValueLTFromObject",
    (u): u is ValueLTObs => u instanceof ValueLTObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("lt_than", ValueGuard.validate(u.lt, ctx)),
        Either.map((val) => new ValueLTObs(val.value, val.lt_than))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      lt: ValueGuard.encode(a.right),
    })
  )
);
export function ValueLT(left: ValueOrNumber, right: ValueOrNumber) {
  return new ValueLTObs(left, right);
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

export const ValueLEObsGuard = ObjG.ValueLE.pipe(
  new t.Type<ValueLEObs, Obj.ValueLE, Obj.ValueLE>(
    "ValueLEFromObject",
    (u): u is ValueLEObs => u instanceof ValueLEObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("le_than", ValueGuard.validate(u.le_than, ctx)),
        Either.map((val) => new ValueLEObs(val.value, val.le_than))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      le_than: ValueGuard.encode(a.right),
    })
  )
);

export function ValueLE(left: ValueOrNumber, right: ValueOrNumber) {
  return new ValueLEObs(left, right);
}

export class ChoseSomething extends Observation {
  constructor(public choiceId: ChoiceId) {
    super();
  }
  eval(env: Environment, state: State) {
    return state.choices.has(choiceIdKey(this.choiceId));
  }
}
export const ChoseSomethingGuard = ObjG.ChoseSomething.pipe(
  new t.Type<ChoseSomething, Obj.ChoseSomething, Obj.ChoseSomething>(
    "ChoseSomethingFromObject",
    (u): u is ChoseSomething => u instanceof ChoseSomething,
    (u, ctx) =>
      pipe(
        ChoiceIdGuard.validate(u.chose_something_for, ctx),
        Either.map((val) => new ChoseSomething(val))
      ),
    (a) => ({ chose_something_for: ChoiceIdGuard.encode(a.choiceId) })
  )
);

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

export const ConstantObsGuard = t.boolean.pipe(
  new t.Type<ConstantObs, boolean, boolean>(
    "ConstantObs",
    (u): u is ConstantObs => u instanceof ConstantObs,
    (u, c) => {
      return t.success(new ConstantObs(u));
    },
    (a) => a.obs
  )
);

export const ObservationGuard: t.Type<Observation, Obj.Observation, unknown> =
  t.recursion("Observation", () =>
    subtypeUnion("Observation", Observation, [
      ConstantObsGuard,
      AndObsGuard,
      OrObsGuard,
      NotObsGuard,
      ValueEqGuard,
      ValueGEObsGuard,
      ValueGTObsGuard,
      ValueLTObsGuard,
      ValueLEObsGuard,
      ChoseSomethingGuard,
    ])
  );

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
  abstract get bundleMap(): Readonly<BundleMap<unknown>>;
  protected abstract reduceContractStep(
    env: Environment,
    state: State
  ): ReduceStepResult;

  // FIXME: Remove from API
  stringify() {
    return ContractGuard.encode(this);
  }

  static parse(val: unknown): Contract {
    return unsafeEither(ContractGuard.decode(val));
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
  get bundleMap() {
    return {};
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
}

export const CloseGuard = ObjG.Close.pipe(
  new t.Type<CloseC, Obj.Close<unknown>, Obj.Close<unknown>>(
    "CloseFromObject",
    (u): u is CloseC => u instanceof CloseC,
    (u, ctx) => {
      return t.success(Close);
    },
    (a) => "close"
  )
);

function bigIntMin(...val: bigint[]) {
  let min = val[0];
  val.forEach((n) => (min = n < min ? n : min));
  return min;
}

class PayC extends Contract {
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
  get bundleMap() {
    this.__build();
    if (!this._bundleMap) {
      throw new Error("Bundle map not initialized");
    }
    return this._bundleMap;
  }
}

export const PayGuard = ObjG.Pay.pipe(
  new t.Type<PayC, Obj.Pay<unknown>, Obj.Pay<unknown>>(
    "PayFromObject",
    (u): u is PayC => u instanceof PayC,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("from_account", PartyGuard.validate(u.from_account, ctx)),
        Either.apS("to", PayeeGuard.validate(u.to, ctx)),
        Either.apS("token", TokenGuard.validate(u.token, ctx)),
        Either.apS("pay", ValueGuard.validate(u.pay, ctx)),
        Either.apS("then", ContractGuard.validate(u.then, ctx)),
        Either.map(
          (val) =>
            new PayC(val.from_account, val.to, val.token, val.pay, val.then)
        )
      ),
    (a) => {
      a.__build();
      return {
        from_account: PartyGuard.encode(a.from),
        to: PayeeGuard.encode(a.to),
        token: TokenGuard.encode(a.token),
        pay: ValueGuard.encode(a.value),
        then: ContractGuard.encode(a.cont),
      };
    }
  )
);

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
}

export const AssertGuard = ObjG.Assert.pipe(
  new t.Type<AssertC, Obj.Assert<unknown>, Obj.Assert<unknown>>(
    "AssertFromObject",
    (u): u is AssertC => u instanceof AssertC,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("assert", ObservationGuard.validate(u.assert, ctx)),
        Either.apS("then", ContractGuard.validate(u.then, ctx)),
        Either.map((val) => new AssertC(val.assert, val.then))
      ),
    (a) => {
      a.__build();
      return {
        assert: ObservationGuard.encode(a.obs),
        then: ContractGuard.encode(a.cont),
      };
    }
  )
);

class LetC extends Contract {
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
}

export const LetGuard = ObjG.Let.pipe(
  new t.Type<LetC, Obj.Let<unknown>, Obj.Let<unknown>>(
    "LetFromObject",
    (u): u is LetC => u instanceof LetC,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("let", t.string.validate(u.let, ctx)),
        Either.apS("be", ValueGuard.validate(u.be, ctx)),
        Either.apS("then", ContractGuard.validate(u.then, ctx)),
        Either.map((val) => new LetC(val.let, val.be, val.then))
      ),
    (a) => {
      a.__build();
      return {
        let: a.valueId,
        be: ValueGuard.encode(a.value),
        then: ContractGuard.encode(a.cont),
      };
    }
  )
);

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

  protected reduceContractStep(
    env: Environment,
    state: State
  ): ReduceStepResult {
    const cont = this.obs.eval(env, state) ? this.ifTrue : this.ifFalse;
    return { reduceEffect: "reduced", state, cont };
  }
}

export const IfGuard = ObjG.If.pipe(
  new t.Type<IfC, Obj.If<unknown>, Obj.If<unknown>>(
    "IfFromObject",
    (u): u is IfC => u instanceof IfC,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("if", ObservationGuard.validate(u.if, ctx)),
        Either.apS("then", ContractGuard.validate(u.then, ctx)),
        Either.apS("else", ContractGuard.validate(u.else, ctx)),
        Either.map((val) => new IfC(val.if, val.then, val.else))
      ),
    (a) => {
      a.__build();
      return {
        if: ObservationGuard.encode(a.obs),
        then: ContractGuard.encode(a.ifTrue),
        else: ContractGuard.encode(a.ifFalse),
      };
    }
  )
);

export type Contingency = [Date, Contract];

const defaultContingency = [new Date(0), new CloseC()] as Contingency;

// TODO: Implement
type Input = String;

export abstract class Case {
  protected built = false;
  abstract __build(): void;
  static parse(val: unknown): Case {
    return unsafeEither(CaseGuard.decode(val));
  }
  defaultContingency: Contingency | undefined;
  abstract bundleMap: BundleMap<unknown>;
}

class NormalCase extends Case {
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

export const NormalCaseGuard = ObjG.NormalCase.pipe(
  new t.Type<NormalCase, Obj.NormalCase<unknown>, Obj.NormalCase<unknown>>(
    "NormalCaseFromObject",
    (u): u is NormalCase => u instanceof NormalCase,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("case", ActionGuard.validate(u.case, ctx)),
        Either.apS("then", ContractGuard.validate(u.then, ctx)),
        Either.map((val) => new NormalCase(val.case, val.then))
      ),
    (a) => {
      a.__build();
      return {
        case: ActionGuard.encode(a.action),
        then: ContractGuard.encode(a.cont),
      };
    }
  )
);

// TODO: Refactor to Ref constructor.
class MerkleizedCase extends Case {
  private _bundleMap?: BundleMap<unknown>;
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

    this._bundleMap = mergeBundleMaps(this.cont.bundleMap, {
      [this.continuationHash]: {
        type: "contract",
        value: ContractGuard.encode(this.cont),
      },
    });
    // this._bundleMap = new Map([...this.cont.bundleMap]);
    // this._bundleMap.set(this.continuationHash, this.cont);
  }
  get bundleMap() {
    this.__build();
    if (!this._bundleMap) {
      throw new Error("Bundle map not initialized");
    }
    return this._bundleMap;
  }
  toJSON() {
    this.__build();
    return {
      case: this.action,
      then: { ref: this.continuationHash },
    };
  }
}
// FIXME
// export const MerkleizedCaseGuard = ObjG.MerkleizedCase.pipe(
//   new t.Type<MerkleizedCase, Obj.NormalCase<unknown>, Obj.NormalCase<unknown>>(
//     "MerkleizedCaseFromObject",
//     (u): u is MerkleizedCase => u instanceof MerkleizedCase,
//     (u, ctx) => t.failure(u, ctx, "Not implemented"),
//       // pipe(
//       //   Either.Do,
//       //   Either.apS("case", ActionGuard.validate(u.case, ctx)),
//       //   Either.apS("then", ContractGuard.validate(u.then, ctx)),
//       //   Either.map((val) => new MerkleizedCase(val.case, val.then))
//       // ),
//     (a) => ({
//       case: ActionGuard.encode(a.action),
//       then: ContractGuard.encode(a.cont),
//     })
//   ));

export const CaseGuard: t.Type<Case, Obj.Case<unknown>, unknown> = t.recursion(
  "Case",
  () => subtypeUnion("Case", Case, [NormalCaseGuard])
);
export abstract class Action {
  static parse(val: unknown): Action {
    return unsafeEither(ActionGuard.decode(val));
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
}

export const NotifyActionGuard = ObjG.Notify.pipe(
  new t.Type<NotifyAction, Obj.Notify, Obj.Notify>(
    "NotifyFromObject",
    (u): u is NotifyAction => u instanceof NotifyAction,
    (u, ctx) =>
      pipe(
        ObservationGuard.validate(u.notify_if, ctx),
        Either.map((val) => new NotifyAction(val))
      ),
    (a) => ({ notify_if: ObservationGuard.encode(a.observation) })
  )
);

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
}

export const DepositActionGuard = ObjG.Deposit.pipe(
  new t.Type<DepositAction, Obj.Deposit, Obj.Deposit>(
    "DepositFromObject",
    (u): u is DepositAction => u instanceof DepositAction,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("deposits", ValueGuard.validate(u.deposits, ctx)),
        Either.apS("into_account", PartyGuard.validate(u.into_account, ctx)),
        Either.apS("of_token", TokenGuard.validate(u.of_token, ctx)),
        Either.apS("party", PartyGuard.validate(u.party, ctx)),
        Either.map(
          (val) =>
            new DepositAction(
              val.into_account,
              val.party,
              val.of_token,
              val.deposits
            )
        )
      ),
    (a) => ({
      deposits: ValueGuard.encode(a.value),
      into_account: PartyGuard.encode(a.intoAccount),
      of_token: TokenGuard.encode(a.token),
      party: PartyGuard.encode(a.from),
    })
  )
);

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

export const ChoiceActionGuard = ObjG.Choice.pipe(
  new t.Type<ChoiceAction, Obj.Choice, Obj.Choice>(
    "ChoiceFromObject",
    (u): u is ChoiceAction => u instanceof ChoiceAction,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("for_choice", ChoiceIdGuard.validate(u.for_choice, ctx)),
        Either.apS(
          "choose_between",
          t.array(BoundGuard).validate(u.choose_between, ctx)
        ),
        Either.map(
          (val) => new ChoiceAction(val.for_choice, val.choose_between)
        )
      ),
    (a) => ({
      for_choice: ChoiceIdGuard.encode(a.choiceId),
      choose_between: a.bounds.map(BoundGuard.encode),
    })
  )
);

export const ActionGuard: t.Type<Action, Obj.Action, unknown> = t.recursion(
  "Action",
  () =>
    subtypeUnion("Action", Action, [
      NotifyActionGuard,
      DepositActionGuard,
      ChoiceActionGuard,
    ])
);

// TODO: Revisit this, why Choice and not ChoiceAction
export type Choice = { choiceName: string; bounds: Bound[] };

export function choice(choiceName: string) {
  return {
    between(...bounds: Bound[]): Choice {
      return { choiceName, bounds };
    },
  };
}
class WhenC extends Contract {
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

export const WhenGuard = ObjG.When.pipe(
  new t.Type<WhenC, Obj.When<unknown>, Obj.When<unknown>>(
    "WhenFromObject",
    (u): u is WhenC => u instanceof WhenC,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("when", t.array(CaseGuard).validate(u.when, ctx)),
        Either.apS("timeout", t.bigint.validate(u.timeout, ctx)),
        Either.apS(
          "timeout_continuation",
          ContractGuard.validate(u.timeout_continuation, ctx)
        ),
        Either.map(
          (val) =>
            new WhenC(val.when).after(
              new Date(Number(val.timeout)),
              val.timeout_continuation
            ) as WhenC
        )
      ),
    (a) => {
      a.__build();
      const contingency =
        a.contingency || a.defaultContingency || defaultContingency;
      return {
        when: a.cases.map(CaseGuard.encode),
        timeout: BigInt(contingency[0].getTime()),
        timeout_continuation: ContractGuard.encode(contingency[1]),
      };
    }
  )
);

export const ContractGuard: t.Type<
  Contract,
  Obj.Contract<unknown>,
  unknown
> = t.recursion("Contract", () =>
  subtypeUnion("Contract", Contract, [
    CloseGuard,
    PayGuard,
    IfGuard,
    WhenGuard,
    LetGuard,
    AssertGuard,
  ])
);

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
