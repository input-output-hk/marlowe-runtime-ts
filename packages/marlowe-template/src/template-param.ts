import * as t from "io-ts/lib/index.js";
import { DateFromEpochMS, StringSplitCodec, TokenCodec } from "./codecs.js";
import { AddressBech32, AddressBech32Guard } from "@marlowe.io/runtime-core";
import { BigIntOrNumber, BigIntOrNumberGuard } from "@marlowe.io/adapter/bigint";
import { Token } from "@marlowe.io/language-core-v1";

/**
 * This interface represents a string parameter in a {@link MarloweTemplate}.
 *
 * Strings are encoded as an array of strings of 64 characters or less to satisfy the ledger's constraints.
 * @typeParam Name - The name of the parameter is used by different type functions to infer the Template's ObjectParam.
 * @category Template parameters
 */
export interface StringParam<Name extends string> {
  readonly name: Name;
  readonly type: "string";
  readonly description?: string;
}

/**
 * This interface represents a value parameter in a {@link MarloweTemplate}.
 *
 * Values are encoded as bigints.
 * @typeParam Name - The name of the parameter is used by different type functions to infer the Template's ObjectParam.
 * @category Template parameters
 */
export interface ValueParam<Name extends string> {
  readonly name: Name;
  readonly type: "value";
  readonly description?: string;
}

/**
 * This interface represents an AddressBech32 parameter in a {@link MarloweTemplate}.
 *
 * An Address is econded as a {@link StringParam}, and it is also guarded to be a valid {@link @marlowe.io/runtime-core!index.AddressBech32}.
 * @typeParam Name - The name of the parameter is used by different type functions to infer the Template's ObjectParam.
 * @category Template parameters
 */
export interface AddressParam<Name extends string> {
  readonly name: Name;
  readonly type: "address";
  readonly description?: string;
}

/**
 * This interface represents a Date parameter in a {@link MarloweTemplate}.
 *
 * Dates are encoded as a bigint representing the milliseconds since the epoch.
 * @typeParam Name - The name of the parameter is used by different type functions to infer the Template's ObjectParam.
 * @category Template parameters
 */
export interface DateParam<Name extends string> {
  readonly name: Name;
  readonly type: "date";
  readonly description?: string;
}

/**
 * This interface represents a token parameter in a {@link MarloweTemplate}.
 *
 * Tokens are encoded as a tuple of 2 {@link StringParam}. The first string is the policy id and the second one is the token name.
 * @typeParam Name - The name of the parameter is used by different type functions to infer the Template's ObjectParam.
 * @category Template parameters
 */
export interface TokenParam<Name extends string> {
  readonly name: Name;
  readonly type: "token";
  readonly description?: string;
}

/**
 * This type represents one of the possible parameters in a {@link MarloweTemplate}.
 *
 * @See The documentation on each parameter to see how is encoded and decoded.
 * @typeParam Name - The name of the parameter is used by different type functions to infer the Template's ObjectParam.
 * @category Template parameters
 */
export type TemplateParam<Name extends string> =
  | StringParam<Name>
  | ValueParam<Name>
  | AddressParam<Name>
  | DateParam<Name>
  | TokenParam<Name>;

/**
 * This type function assigns a type to each {@link TemplateParam}.
 * @internal
 * @category Type functions
 */
export type TypeOfParam<Param extends TemplateParam<any>> = Param extends StringParam<infer Name>
  ? string
  : Param extends ValueParam<infer Name>
  ? BigIntOrNumber
  : Param extends AddressParam<infer Name>
  ? AddressBech32
  : Param extends DateParam<infer Name>
  ? Date
  : Param extends TokenParam<infer Name>
  ? Token
  : never;

/**
 * This type function receives a list of {@link TemplateParam} and returns
 * the union of the names of the parameters.
 * @internal
 * @category Type functions
 */
export type TemplateKeys<T extends readonly TemplateParam<any>[]> = {
  [K in keyof T]: T[K] extends TemplateParam<infer Name> ? Name : never;
}[number];

/**
 * This type function receives a list of {@link TemplateParam} and returns
 * an object whose keys are the param name and value is the {@link TypeOfParam}.
 * @internal
 * @category Type functions
 */
export type TemplateType<T extends readonly TemplateParam<any>[]> = {
  [K in TemplateKeys<T>]: TypeOfParam<Extract<T[number], { name: K }>>;
};

function templateParamCodec<Param extends TemplateParam<any>>(param: Param): t.Mixed {
  switch (param.type) {
    case "string":
      return StringSplitCodec;
    case "value":
      return BigIntOrNumberGuard;
    case "address":
      return StringSplitCodec.pipe(AddressBech32Guard);
    case "date":
      return DateFromEpochMS;
    case "token":
      return TokenCodec;
    default:
      throw new Error("Invalid parameter type");
  }
}

/**
 * @hidden
 */
export function templateParamsCodec<T extends readonly TemplateParam<any>[]>(template: T): t.Mixed {
  return t.tuple(template.map(templateParamCodec) as any);
}

/**
 * @hidden
 */
export function templateParamsObjectGuard<T extends readonly TemplateParam<any>[]>(template: T): t.Mixed {
  return t.type(Object.fromEntries(template.map((param) => [param.name, templateParamCodec(param)])) as any);
}
