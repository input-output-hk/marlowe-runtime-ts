import * as t from "io-ts/lib/index.js";
import { withValidate } from "io-ts-types";
import { MarloweJSON } from "./codec.js";
import { Errors } from "io-ts/lib/index.js";
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

export function assertGuardEqual<A, G extends t.Type<A, any, any>>(
  proxy: A,
  guard: G
): G {
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
  return withValidate(
    codec,
    (u, c) => (u == null ? t.success(undefined) : codec.validate(u, c)),
    name
  );
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
    throw `Expected value from type ${
      guard.name
    } but got ${MarloweJSON.stringify(aValue, null, 4)} `;
  }
}

/**
 * A mechanism for validating the type of a strict in a dynamically type context.
 * @param strict Whether to perform runtime checking to provide helpful error messages. May have a slight negative performance impact.
 */
export function strictDynamicTypeCheck(strict: unknown): strict is boolean {
  return typeof strict === "boolean";
}

export class InvalidTypeError extends Error {
  constructor(
    public readonly errors: Errors,
    public readonly value: any,
    message?: string
  ) {
    super(message);
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
    (input, context) =>
      guard(input) ? t.success(literal) : t.failure(input, context),
    t.identity
  );
}

type Constructor<C = {}> = abstract new (...args: any[]) => C;

/**
 * This type guard is similar to t.union but for subtypes of a given class.
 * @param name The name of the guarded type
 * @param constructor The constructor of the base class
 * @param guards A list of guards for the subtypes
 */
export function subtypeUnion<C, C1, O1>(
  name: string,
  constructor: Constructor<C>,
  guards: [t.Type<C1, O1, any>]
): t.Type<C, O1, unknown>;
export function subtypeUnion<C, C1, O1, C2, O2>(
  name: string,
  constructor: Constructor<C>,
  guards: [t.Type<C1, O1, any>, t.Type<C2, O2, any>]
): t.Type<C, O1 | O2, unknown>;
export function subtypeUnion<C, C1, O1, C2, O2, C3, O3>(
  name: string,
  constructor: Constructor<C>,
  guards: [t.Type<C1, O1, any>, t.Type<C2, O2, any>, t.Type<C3, O3, any>]
): t.Type<C, O1 | O2 | O3, unknown>;
export function subtypeUnion<C, C1, O1, C2, O2, C3, O3, C4, O4>(
  name: string,
  constructor: Constructor<C>,
  guards: [
    t.Type<C1, O1, any>,
    t.Type<C2, O2, any>,
    t.Type<C3, O3, any>,
    t.Type<C4, O4, any>,
  ]
): t.Type<C, O1 | O2 | O3 | O4, unknown>;
export function subtypeUnion<C, C1, O1, C2, O2, C3, O3, C4, O4, C5, O5>(
  name: string,
  constructor: Constructor<C>,
  guards: [
    t.Type<C1, O1, any>,
    t.Type<C2, O2, any>,
    t.Type<C3, O3, any>,
    t.Type<C4, O4, any>,
    t.Type<C5, O5, any>,
  ]
): t.Type<C, O1 | O2 | O3 | O4 | O5, unknown>;
export function subtypeUnion<C, C1, O1, C2, O2, C3, O3, C4, O4, C5, O5, C6, O6>(
  name: string,
  constructor: Constructor<C>,
  guards: [
    t.Type<C1, O1, any>,
    t.Type<C2, O2, any>,
    t.Type<C3, O3, any>,
    t.Type<C4, O4, any>,
    t.Type<C5, O5, any>,
    t.Type<C6, O6, any>,
  ]
): t.Type<C, O1 | O2 | O3 | O4 | O5 | O6, unknown>;
export function subtypeUnion<C>(
  name: string,
  constructor: Constructor<C>,
  guards: t.Any[]
): t.Type<C, any, any>;
export function subtypeUnion<C>(
  name: string,
  constructor: Constructor<C>,
  guards: t.Any[]
): t.Type<C, any, any> {
  return new t.Type(
    name,
    (u): u is C => u instanceof constructor,
    (u, c) => {
      for (const guard of guards) {
        const result = guard.validate(u, c);
        if (result._tag === "Right") {
          return t.success(result.right);
        }
      }
      return t.failure(u, c, "Value does not match any of the subtype guards");
    },
    (a) => {
      for (const guard of guards) {
        if (guard.is(a)) {
          return guard.encode(a);
        }
      }
      throw new Error("Unknown type");
    }
  );
}
