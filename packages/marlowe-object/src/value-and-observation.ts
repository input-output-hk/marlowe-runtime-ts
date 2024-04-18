import * as t from "io-ts/lib/index.js";
import * as G from "@marlowe.io/language-core-v1/guards";
import { ChoiceId, ChoiceIdGuard } from "./choices.js";
import { AccountId, AccountIdGuard } from "./payee.js";
import { Token, TokenGuard } from "./token.js";
import { Constant, TimeIntervalStart, TimeIntervalEnd, UseValue, ValueId } from "@marlowe.io/language-core-v1";
import { Reference, ReferenceGuard } from "./reference.js";

export { Constant, TimeIntervalStart, TimeIntervalEnd, UseValue, ValueId };

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.AvailableMoney | Core AvailableMoney}.
 * @category Value
 */
export interface AvailableMoney {
  amount_of_token: Token;
  in_account: AccountId;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link AvailableMoney | available money type}.
 * @category Value
 */
export const AvailableMoneyGuard: t.Type<AvailableMoney> = t.type({
  amount_of_token: TokenGuard,
  in_account: AccountIdGuard,
});

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.NegValue | Core NegValue}.
 * @category Value
 */
export interface NegValue {
  negate: Value;
}
/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link NegValue | neg value type}.
 * @category Value
 */
export const NegValueGuard: t.Type<NegValue> = t.recursion("NegValue", () => t.type({ negate: ValueGuard }));

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.AddValue | Core AddValue}.
 * @category Value
 */
export interface AddValue {
  add: Value;
  and: Value;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link AddValue | add value type}.
 * @category Value
 */
export const AddValueGuard: t.Type<AddValue> = t.recursion("AddValue", () =>
  t.type({ add: ValueGuard, and: ValueGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.SubValue | Core SubValue}.
 * @category Value
 */
export interface SubValue {
  value: Value;
  minus: Value;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link SubValue | sub value type}.
 * @category Value
 */
export const SubValueGuard: t.Type<SubValue> = t.recursion("SubValue", () =>
  t.type({ value: ValueGuard, minus: ValueGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.MulValue | Core MulValue}.
 * @category Value
 */
export interface MulValue {
  multiply: Value;
  times: Value;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link MulValue | mul value type}.
 * @category Value
 */
export const MulValueGuard: t.Type<MulValue> = t.recursion("MulValue", () =>
  t.type({ multiply: ValueGuard, times: ValueGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.DivValue | Core DivValue}.
 * @category Value
 */
export interface DivValue {
  divide: Value;
  by: Value;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link DivValue | div value type}.
 * @category Value
 */
export const DivValueGuard: t.Type<DivValue> = t.recursion("DivValue", () =>
  t.type({ divide: ValueGuard, by: ValueGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.ChoiceValue | Core ChoiceValue}.
 * @category Value
 */
export type ChoiceValue = { value_of_choice: ChoiceId };
/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ChoiceValue | choice value type}.
 * @category Value
 */
export const ChoiceValueGuard: t.Type<ChoiceValue> = t.recursion("ChoiceValue", () =>
  t.type({ value_of_choice: ChoiceIdGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.Cond | Core Cond}.
 * @category Value
 */
export interface Cond {
  if: Observation;
  then: Value;
  else: Value;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Cond | cond value type}.
 * @category Value
 */
export const CondGuard: t.Type<Cond> = t.recursion("Cond", () =>
  t.type({ if: ObservationGuard, then: ValueGuard, else: ValueGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.Value | Core Value} with
 * the ability to reference other values.
 * @category Value
 */
export type Value =
  | AvailableMoney
  | Constant
  | NegValue
  | AddValue
  | SubValue
  | MulValue
  | DivValue
  | ChoiceValue
  | TimeIntervalStart
  | TimeIntervalEnd
  | UseValue
  | Cond
  | Reference;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Value | value type}.
 * @category Value
 */
export const ValueGuard: t.Type<Value> = t.recursion("Value", () =>
  t.union([
    AvailableMoneyGuard,
    G.Constant,
    NegValueGuard,
    AddValueGuard,
    SubValueGuard,
    MulValueGuard,
    DivValueGuard,
    ChoiceValueGuard,
    G.TimeIntervalStart,
    G.TimeIntervalEnd,
    G.UseValue,
    CondGuard,
    ReferenceGuard,
  ])
);

/**
 * Pattern match object on the Value type
 * @category Value
 * @hidden
 */
export type ValueMatcher<T> = {
  availableMoney: (value: AvailableMoney) => T;
  constant: (value: Constant) => T;
  negValue: (value: NegValue) => T;
  addValue: (value: AddValue) => T;
  subValue: (value: SubValue) => T;
  mulValue: (value: MulValue) => T;
  divValue: (value: DivValue) => T;
  choiceValue: (value: ChoiceValue) => T;
  timeIntervalStart: (value: TimeIntervalStart) => T;
  timeIntervalEnd: (value: TimeIntervalEnd) => T;
  useValue: (value: UseValue) => T;
  cond: (value: Cond) => T;
  reference: (value: Reference) => T;
};

/**
 * Pattern matching on the Value type
 * @hidden
 * @category Value
 */
export function matchValue<T>(matcher: ValueMatcher<T>): (value: Value) => T;
export function matchValue<T>(matcher: Partial<ValueMatcher<T>>): (value: Value) => T | undefined;
export function matchValue<T>(matcher: Partial<ValueMatcher<T>>) {
  return (value: Value) => {
    if (AvailableMoneyGuard.is(value) && matcher.availableMoney) {
      return matcher.availableMoney(value);
    } else if (G.Constant.is(value) && matcher.constant) {
      return matcher.constant(value);
    } else if (NegValueGuard.is(value) && matcher.negValue) {
      return matcher.negValue(value);
    } else if (AddValueGuard.is(value) && matcher.addValue) {
      return matcher.addValue(value);
    } else if (SubValueGuard.is(value) && matcher.subValue) {
      return matcher.subValue(value);
    } else if (MulValueGuard.is(value) && matcher.mulValue) {
      return matcher.mulValue(value);
    } else if (DivValueGuard.is(value) && matcher.divValue) {
      return matcher.divValue(value);
    } else if (ChoiceValueGuard.is(value) && matcher.choiceValue) {
      return matcher.choiceValue(value);
    } else if (G.TimeIntervalStart.is(value) && matcher.timeIntervalStart) {
      return matcher.timeIntervalStart(value);
    } else if (G.TimeIntervalEnd.is(value) && matcher.timeIntervalEnd) {
      return matcher.timeIntervalEnd(value);
    } else if (G.UseValue.is(value) && matcher.useValue) {
      return matcher.useValue(value);
    } else if (CondGuard.is(value) && matcher.cond) {
      return matcher.cond(value);
    } else if (ReferenceGuard.is(value) && matcher.reference) {
      return matcher.reference(value);
    }
  };
}

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.AndObs | Core AndObs}.
 * @category Observation
 */
export interface AndObs {
  both: Observation;
  and: Observation;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link AndObs | and type}.
 * @category Observation
 */
export const AndObsGuard: t.Type<AndObs> = t.recursion("AndObs", () =>
  t.type({ both: ObservationGuard, and: ObservationGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.OrObs | Core OrObs}.
 * @category Observation
 */
export interface OrObs {
  either: Observation;
  or: Observation;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link OrObs | or type}.
 * @category Observation
 */
export const OrObsGuard: t.Type<OrObs> = t.recursion("OrObs", () =>
  t.type({ either: ObservationGuard, or: ObservationGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.NotObs | Core NotObs}.
 * @category Observation
 */
export interface NotObs {
  not: Observation;
}
/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link NotObs | not type}.
 * @category Observation
 */
export const NotObsGuard: t.Type<NotObs> = t.recursion("NotObs", () => t.type({ not: ObservationGuard }));

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.ChoseSomething | Core ChoseSomething}.
 * @category Observation
 */
export interface ChoseSomething {
  chose_something_for: ChoiceId;
}
/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ChoseSomething | choose something type}.
 * @category Observation
 */
// TODO: try to remove recursion
export const ChoseSomethingGuard: t.Type<ChoseSomething> = t.recursion("ChoseSomething", () =>
  t.type({ chose_something_for: ChoiceIdGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.ValueEQ | Core ValueEQ}.
 * @category Observation
 */
export interface ValueEQ {
  value: Value;
  equal_to: Value;
}
/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ValueEQ | value eq type}.
 * @category Observation
 */
export const ValueEQGuard: t.Type<ValueEQ> = t.recursion("ValueEQ", () =>
  t.type({ value: ValueGuard, equal_to: ValueGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.ValueGT | Core ValueGT}.
 * @category Observation
 */
export interface ValueGT {
  value: Value;
  gt: Value;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ValueGT | value greater than type}.
 * @category Observation
 */
export const ValueGTGuard: t.Type<ValueGT> = t.recursion("ValueGT", () =>
  t.type({ value: ValueGuard, gt: ValueGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.ValueGE | Core ValueGE}.
 * @category Observation
 */
export interface ValueGE {
  value: Value;
  ge_than: Value;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ValueGE | value greater or equal type}.
 * @category Observation
 */
export const ValueGEGuard: t.Type<ValueGE> = t.recursion("ValueGE", () =>
  t.type({ value: ValueGuard, ge_than: ValueGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.ValueLT | Core ValueLT}.
 * @category Observation
 */
export interface ValueLT {
  value: Value;
  lt: Value;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ValueLT | value lower than type}.
 * @category Observation
 */
export const ValueLTGuard: t.Type<ValueLT> = t.recursion("ValueLT", () =>
  t.type({ value: ValueGuard, lt: ValueGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.ValueLE | Core ValueLE}.
 * @category Observation
 */
export interface ValueLE {
  value: Value;
  le_than: Value;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ValueLE | value lower or equal type}.
 * @category Observation
 */
export const ValueLEGuard: t.Type<ValueLE> = t.recursion("ValueLE", () =>
  t.type({ value: ValueGuard, le_than: ValueGuard })
);

/**
 * Marlowe Object version of {@link @marlowe.io/language-core-v1!index.Observation | Core Observation} with
 * the ability to reference other observations.
 * @category Observation
 */
export type Observation =
  | AndObs
  | OrObs
  | NotObs
  | ChoseSomething
  | ValueEQ
  | ValueGT
  | ValueGE
  | ValueLT
  | ValueLE
  | boolean
  | Reference;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Observation | observation type}.
 * @category Observation
 */
export const ObservationGuard: t.Type<Observation> = t.recursion("Observation", () =>
  t.union([
    AndObsGuard,
    OrObsGuard,
    NotObsGuard,
    ChoseSomethingGuard,
    ValueEQGuard,
    ValueGTGuard,
    ValueGEGuard,
    ValueLTGuard,
    ValueLEGuard,
    t.boolean,
    ReferenceGuard,
  ])
);

/**
 * Pattern match object on the Observation type
 * @category Observation
 * @hidden
 */
export type ObservationMatcher<T> = {
  andObs: (observation: AndObs) => T;
  orObs: (observation: OrObs) => T;
  notObs: (observation: NotObs) => T;
  choseSomething: (observation: ChoseSomething) => T;
  valueEQ: (observation: ValueEQ) => T;
  valueGT: (observation: ValueGT) => T;
  valueGE: (observation: ValueGE) => T;
  valueLT: (observation: ValueLT) => T;
  valueLE: (observation: ValueLE) => T;
  trueObs: (observation: true) => T;
  falseObs: (observation: false) => T;
  reference: (observation: Reference) => T;
};

/**
 * Pattern matching on the Observation type
 * @hidden
 * @category Observation
 */
export function matchObservation<T>(matcher: ObservationMatcher<T>): (observation: Observation) => T;
export function matchObservation<T>(
  matcher: Partial<ObservationMatcher<T>>
): (observation: Observation) => T | undefined;
export function matchObservation<T>(matcher: Partial<ObservationMatcher<T>>) {
  return (observation: Observation) => {
    if (AndObsGuard.is(observation) && matcher.andObs) {
      return matcher.andObs(observation);
    } else if (OrObsGuard.is(observation) && matcher.orObs) {
      return matcher.orObs(observation);
    } else if (NotObsGuard.is(observation) && matcher.notObs) {
      return matcher.notObs(observation);
    } else if (ChoseSomethingGuard.is(observation) && matcher.choseSomething) {
      return matcher.choseSomething(observation);
    } else if (ValueEQGuard.is(observation) && matcher.valueEQ) {
      return matcher.valueEQ(observation);
    } else if (ValueGTGuard.is(observation) && matcher.valueGT) {
      return matcher.valueGT(observation);
    } else if (ValueGEGuard.is(observation) && matcher.valueGE) {
      return matcher.valueGE(observation);
    } else if (ValueLTGuard.is(observation) && matcher.valueLT) {
      return matcher.valueLT(observation);
    } else if (ValueLEGuard.is(observation) && matcher.valueLE) {
      return matcher.valueLE(observation);
    } else if (observation == true && matcher.trueObs) {
      return matcher.trueObs(observation);
    } else if (observation == false && matcher.falseObs) {
      return matcher.falseObs(observation);
    } else if (ReferenceGuard.is(observation) && matcher.reference) {
      return matcher.reference(observation);
    }
  };
}
