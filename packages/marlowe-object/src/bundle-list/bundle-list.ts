import * as t from "io-ts/lib/index.js";
import { Action, ActionGuard } from "../actions.js";
import { Contract, ContractGuard } from "../contract.js";
import { Party, PartyGuard } from "../participants.js";
import { Label, LabelGuard } from "../reference.js";
import { Token, TokenGuard } from "../token.js";
import { ValueGuard, Value, Observation, ObservationGuard } from "../value-and-observation.js";

/**
 * An entry of a {@link BundleList} that references a {@link Party}.
 * @category Object
 */
export interface ObjectParty {
  label: Label;
  type: "party";
  value: Party;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectParty | object party type}.
 * @category Object
 */
export const ObjectPartyGuard: t.Type<ObjectParty> = t.type({
  label: LabelGuard,
  type: t.literal("party"),
  value: PartyGuard,
});

/**
 * An entry of a {@link BundleList} that references a {@link Value}.
 * @category Object
 */
export interface ObjectValue {
  label: Label;
  type: "value";
  value: Value;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectValue | object value type}.
 * @category Object
 */
export const ObjectValueGuard: t.Type<ObjectValue> = t.type({
  label: LabelGuard,
  type: t.literal("value"),
  value: ValueGuard,
});

/**
 * An entry of a {@link BundleList} that references an {@link Observation}.
 * @category Object
 */
export interface ObjectObservation {
  label: Label;
  type: "observation";
  value: Observation;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectObservation | object observation type}.
 * @category Object
 */
export const ObjectObservationGuard: t.Type<ObjectObservation> = t.type({
  label: LabelGuard,
  type: t.literal("observation"),
  value: ObservationGuard,
});

/**
 * An entry of a {@link BundleList} that references a {@link Token}.
 * @category Object
 */
export interface ObjectToken {
  label: Label;
  type: "token";
  value: Token;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectToken | object token type}.
 * @category Object
 */
export const ObjectTokenGuard: t.Type<ObjectToken> = t.type({
  label: LabelGuard,
  type: t.literal("token"),
  value: TokenGuard,
});

/**
 * An entry of a {@link BundleList} that references a {@link Contract}.
 * @category Object
 */
export interface ObjectContract<A> {
  label: Label;
  type: "contract";
  value: Contract<A>;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectContract | object contract type}.
 * @category Object
 */
export const ObjectContractGuard: t.Type<ObjectContract<unknown>> = t.type({
  label: LabelGuard,
  type: t.literal("contract"),
  value: ContractGuard,
});

/**
 * An entry of a {@link BundleList} that references a an {@link Action}.
 * @category Object
 */
export interface ObjectAction {
  label: Label;
  type: "action";
  value: Action;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectAction | object action type}.
 * @category Object
 */
export const ObjectActionGuard: t.Type<ObjectAction> = t.type({
  label: LabelGuard,
  type: t.literal("action"),
  value: ActionGuard,
});

/**
 * An entry of a {@link BundleList} that references a {@link Party}, {@link Value}, {@link Observation}, {@link Token}, {@link Contract}, or {@link Action}.
 * @category Object
 */
export type ObjectType<A> =
  | ObjectParty
  | ObjectValue
  | ObjectObservation
  | ObjectToken
  | ObjectContract<A>
  | ObjectAction;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectType | object type}.
 * @category Object
 */
export const ObjectTypeGuard = t.union([
  ObjectPartyGuard,
  ObjectValueGuard,
  ObjectObservationGuard,
  ObjectTokenGuard,
  ObjectContractGuard,
  ObjectActionGuard,
]);

/**
 * A bundle of {@link ObjectType | ObjectType's}.
 * @category Object
 */
export type BundleList<A> = ObjectType<A>[];

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link BundleList | bundle type}.
 * @category Object
 */
export const BundleListGuard = t.array(ObjectTypeGuard);

/**
 * A contract bundle is just a {@link BundleList} with a main entrypoint.
 * @category Object
 */
export interface ContractBundleList<A> {
  main: Label;
  bundle: BundleList<A>;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ContractBundleList | contract bundle type}.
 */
export const ContractBundleListGuard: t.Type<ContractBundleList<unknown>> = t.type({
  main: LabelGuard,
  bundle: BundleListGuard,
});
