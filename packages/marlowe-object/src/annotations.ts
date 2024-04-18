import * as t from "io-ts/lib/index.js";
import * as R from "fp-ts/lib/Record.js";
import * as O from "fp-ts/lib/Option.js";

/**
 * This interface represents JavaScript objects that can be annotated on a parameterized
 * value `A`. Primitive values like `string` or `bigint` cannot be annotated, but classes like
 * `String` can.
 *
 * A contract can be annotated with information that helps to derive a contract logical state
 * depending on the current node of the contract. It can also be used to provide location information
 * from a higer level language that generates Marlowe, allowing source mapping in a simulation.
 * @typeParam A The type of the annotation
 * @category Annotation
 */
export interface Annotated<A> {
  annotation: A;
}

/**
 * Guard function to check if a `value` is {@link Annotated}
 * @category Annotation
 */
export function isAnnotated(value: unknown): value is Annotated<unknown> {
  return (
    typeof value === "object" && value !== null && "annotation" in value && typeof value["annotation"] !== "undefined"
  );
}

/**
 * {@link !io-ts-usage | Dynamic type guard} for the {@link Annotated | annotated type}.
 * @category Annotation
 */
export const AnnotatedGuard = <A>(guard: t.Type<A>): t.Type<Annotated<A>> => t.type({ annotation: guard });

/**
 * Recursively removes  {@link index.Annotated | annotations} from an object.
 * @typeParam T - This function receives and returns the same type T.
 * @category Annotation
 */
export function stripAnnotations<T>(value: T): T {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (value instanceof String) {
    return `${value}` as T;
  }
  if (Array.isArray(value)) {
    return value.map(stripAnnotations) as T;
  }
  return R.filterMapWithIndex((key, v) => (key === "annotation" ? O.none : O.some(stripAnnotations(v))))(
    value as any
  ) as T;
}
