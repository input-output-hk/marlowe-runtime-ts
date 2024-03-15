import * as t from "io-ts/lib/index.js";
import { withValidate } from "io-ts-types";
import { MarloweJSON } from "./codec.js";
import { Errors } from "io-ts/lib/index.js";
import { Refinement } from "fp-ts/lib/Refinement.js";
import { pipe } from "fp-ts/lib/function.js";
import * as Either from "fp-ts/lib/Either.js";
import * as BigIntReporter from "jsonbigint-io-ts-reporters";

/**
 * In the TS-SDK we duplicate the type and guard definition for each type as the
 * inferred type from io-ts does not produce a good type export when used with
 * typedoc. Sadly this means we have to maintain two definitions for each type which
 * can lead to errors, so we need a mechanism to assert that the type and guard are
 * equal.
 * Normally we could simply do:
  ```
  interface Foo {
      prop: string;
  }
  const FooGuard: t.Type<Foo> = t.type({
      prop: t.string
  })
  ```
 * And the explicit type assertion in the FooGuard ensure us that the type are the same.
 * But when we include Branded or Newtype types in the definition, the full type is not the same
  ```
  interface Foo {
      prop: ContractId;
  }
  // This throws a type error
  const FooGuard: t.Type<Foo> = t.type({
      prop: ContractIdGuard
  })
  ```
 *
 * To understand the error we need to know that  `t.Type<A> = t.Type<A, O = A, I = unknown>`
 * where `A` is the underlying type, `O` is the Output type that we get when
 * we call `FooGuard.encode` and `I` is the Input type we expect when we call `FooGuard.decode`.
 * When we use a Branded or Newtype guard, the Output type is different from the underlying type,
 * so we get an error.
 *
 * The `assertGuardEqual` function can be used to only assert on the representation type A and leave
 * the Input and Output type unchanged.
 *
  ```
  interface Foo {
      prop: ContractId;
  }
  const FooGuard = assertGuardEqual(proxy<Foo>(), t.type({
      prop: ContractIdGuard
  }))
  ```
 */

export function assertGuardEqual<A, G extends t.Type<A, any, any>>(proxy: A, guard: G): G {
  return guard;
}

/**
 * Utility function to set up an unused value with an explicit type A.
 * @returns
 */
export function proxy<A = never>(): A {
  return null as any;
}

/**
 * converts a null value to an undefined one.
 * @returns
 */
export function convertNullableToUndefined<C extends t.Mixed>(
  codec: C,
  name = `fromNullableToUndefined(${codec.name})`
): C {
  return withValidate(codec, (u, c) => (u == null ? t.success(undefined) : codec.validate(u, c)), name);
}
/**
 * Convert an unknown value to `T` if the guard provided is validating the unknown value.
 * @param guard
 * @param aValue
 * @returns
 */
export function expectType<T>(guard: t.Type<T>, aValue: unknown): T {
  if (guard.is(aValue)) {
    return aValue;
  } else {
    throw `Expected value from type ${guard.name} but got ${MarloweJSON.stringify(aValue, null, 4)} `;
  }
}

/**
 * Formats validation errors into a string.
 * @param errors - The validation errors to format.
 * @returns A string representation of the validation errors.
 */
export function formatValidationErrors(errors: Errors): string {
  return BigIntReporter.formatValidationErrors(errors, {
    truncateLongTypes: true,
  }).join("\n");
}

export function dynamicAssertType<G extends t.Any>(
  guard: G,
  value: unknown,
  message?: string
): t.TypeOf<G> {
  const result = guard.decode(value);
  if (Either.isLeft(result)) {
    throw new InvalidTypeError(guard, value, result.left, message);
  }
  return result.right;
}

/**
 * This error is thrown when we are dynamicly checking for the type of a value and the type is not
 * the expected one.
 */
export class InvalidTypeError extends Error {
  constructor(
    public readonly guard: t.Any,
    public readonly value: unknown,
    public readonly errors: Errors,
    message?: string
  ) {
    const msg =
      message ??
      `Unexpected type for value:\n${formatValidationErrors(errors)}`;
    super(msg);
  }
}

/**
 * This function creates a guard that matches with a literal string or an object
 * than can be coerced to a literal string, like the String object
 */
export function likeLiteral<S extends string>(literal: S): t.Type<S> {
  function guard(input: unknown): input is S {
    if (typeof input === "string") {
      return input === literal;
    }
    if (typeof input === "object" && input instanceof String) {
      return input.valueOf() === literal;
    }
    return false;
  }
  return new t.Type(
    literal,
    (input: unknown): input is S => guard(input),
    (input, context) => (guard(input) ? t.success(literal) : t.failure(input, context)),
    t.identity
  );
}

export interface BrandP<A, B extends A, I> extends t.Type<t.Branded<A, B>, t.Branded<A, B>, I> {}

// The library io-ts has the helper t.brand which refines a type A into a type B
// given a predicate. When we use that helper, the resulting codec changes the Actual
// type to t.Branded<A, B>, and keeps the same Output type as the underlying codec.
// When branding primitive types this might not be the expected behaviour as you can
// get a PositiveInt codec of type t.Type<PositiveInt, number, unknown>, which can cause
// some hiccups when used in recursive data types as explained in the following issue:
// https://github.com/gcanti/io-ts/issues/604.
// This helper is a workaround to that issue, making sure that if the original codec
// has the same Output than the Actual type, the new codec outputs the branded type
// So a PositiveInt codec will have the type t.Type<PositiveInt, PositiveInt, unknown>
export function preservedBrand<C extends t.Any, N extends string, B extends { readonly [K in N]: symbol }>(
  codec: C,
  predicate: Refinement<t.TypeOf<C>, t.Branded<t.TypeOf<C>, B>>,
  name: N
): BrandP<t.TypeOf<C>, B, t.InputOf<C>> {
  return new t.Type(
    name,
    (u): u is t.Branded<t.TypeOf<C>, B> => codec.is(u) && predicate(u),
    (u, c) =>
      pipe(
        codec.validate(u, c),
        Either.chain((a) =>
          predicate(a)
            ? t.success(a as t.Branded<t.TypeOf<C>, B>)
            : t.failure<t.Branded<t.TypeOf<C>, B>>(a, c, `Value does not satisfy the ${name} constraint`)
        )
      ),
    (a) => a
  );
}
