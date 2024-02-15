import * as t from "io-ts/lib/index.js";
import { Action, ActionGuard } from "../actions.js";
import { Contract, ContractGuard } from "../contract.js";
import { Party, PartyGuard } from "../participants.js";
import { Label, LabelGuard } from "../reference.js";
import { Token, TokenGuard } from "../token.js";
import {
  ValueGuard,
  Value,
  Observation,
  ObservationGuard,
} from "../value-and-observation.js";
import * as R from "fp-ts/lib/Record.js";
import { deepEqual } from "@marlowe.io/adapter/deep-equal";
import { MarloweJSON } from "@marlowe.io/adapter/codec";

/**
 * An entry of a {@link BundleMap} that references a {@link Party}.
 * @category Object
 */
export interface ObjectParty {
  type: "party";
  value: Party;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectParty | object party type}.
 * @category Object
 */
export const ObjectPartyGuard: t.Type<ObjectParty> = t.type({
  type: t.literal("party"),
  value: PartyGuard,
});

/**
 * An entry of a {@link BundleMap} that references a {@link Value}.
 * @category Object
 */
export interface ObjectValue {
  type: "value";
  value: Value;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectValue | object value type}.
 * @category Object
 */
export const ObjectValueGuard: t.Type<ObjectValue> = t.type({
  type: t.literal("value"),
  value: ValueGuard,
});

/**
 * An entry of a {@link BundleMap} that references an {@link Observation}.
 * @category Object
 */
export interface ObjectObservation {
  type: "observation";
  value: Observation;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectObservation | object observation type}.
 * @category Object
 */
export const ObjectObservationGuard: t.Type<ObjectObservation> = t.type({
  type: t.literal("observation"),
  value: ObservationGuard,
});

/**
 * An entry of a {@link BundleMap} that references a {@link Token}.
 * @category Object
 */
export interface ObjectToken {
  type: "token";
  value: Token;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectToken | object token type}.
 * @category Object
 */
export const ObjectTokenGuard: t.Type<ObjectToken> = t.type({
  type: t.literal("token"),
  value: TokenGuard,
});

/**
 * An entry of a {@link BundleMap} that references a {@link Contract}.
 * @category Object
 */
export interface ObjectContract<A> {
  type: "contract";
  value: Contract<A>;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectContract | object contract type}.
 * @category Object
 */
export const ObjectContractGuard: t.Type<ObjectContract<unknown>> = t.type({
  type: t.literal("contract"),
  value: ContractGuard,
});

/**
 * An entry of a {@link BundleMap} that references a an {@link Action}.
 * @category Object
 */
export interface ObjectAction {
  type: "action";
  value: Action;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ObjectAction | object action type}.
 * @category Object
 */
export const ObjectActionGuard: t.Type<ObjectAction> = t.type({
  type: t.literal("action"),
  value: ActionGuard,
});

/**
 * An entry of a {@link BundleMap} that references a {@link Party}, {@link Value}, {@link Observation}, {@link Token}, {@link Contract}, or {@link Action}.
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
export type BundleMap<A> = Record<Label, ObjectType<A>>;

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link BundleMap | bundle type}.
 * @category Object
 */
export const BundleMapGuard: t.Type<BundleMap<unknown>> = t.record(
  LabelGuard,
  ObjectTypeGuard
);

/**
 * Combines two {@link BundleMap | bundle maps} into one. If the same key is present in both maps, the values need to be
 * the same or the function will throw.
 */
export const mergeBundleMaps = <A>(
  left: BundleMap<A>,
  right: BundleMap<A>
): BundleMap<A> => {
  const mergeSameKey = {
    concat: (x: ObjectType<A>, y: ObjectType<A>) => {
      if (!deepEqual(x, y)) {
        throw new Error(
          `Cannot merge two different objects with the same key: ${MarloweJSON.stringify(
            x
          )} and ${MarloweJSON.stringify(y)}`
        );
      }
      return x;
    },
  };
  return R.union(mergeSameKey)(right)(left);
};

/**
 * A contract bundle is just a {@link BundleMap} with a main entrypoint.
 * @category Object
 */
export interface ContractBundleMap<A> {
  main: Label;
  objects: BundleMap<A>;
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link ContractBundleList | contract bundle type}.
 */
export const ContractBundleMapGuard: t.Type<ContractBundleMap<unknown>> =
  t.type({
    main: LabelGuard,
    objects: BundleMapGuard,
  });
