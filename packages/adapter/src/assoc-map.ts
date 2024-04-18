/**
 * This module offers utility functions to work with {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map | Map}'s defined as ordered associative lists.
 * It is implemented as defined in the Marlowe spec.
 * @see {@link https://github.com/input-output-hk/marlowe/blob/master/isabelle/Util/MList.thy }
 * @packageDocumentation
 */
import * as t from "io-ts/lib/index.js";
/**
 * A {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map | Map}
 * represented as an ordered associative list
 * @typeParam K The type of the keys in the map.
 * @typeParam V The type of the values in the map.
 */
export type AssocMap<K, V> = Array<[K, V]>;
// DISCUSSION: The AssocMap is how Map's in Marlowe are serialized, but in terms of performance, it
//             would make sense to use JS native Map. We should decide if we internally use JS Maps and
//             in relevant places (mainly Core.State) we encode/decode to this, or if we use this representation
//             all the way (current approach).

export const AssocMapGuard = <K, V>(keyGuard: t.Type<K>, valueGuard: t.Type<V>): t.Type<AssocMap<K, V>> =>
  t.array(t.tuple([keyGuard, valueGuard]));

export type Sort = "GreaterThan" | "LowerThan" | "EqualTo";

export type Linorder<K> = (a: K, b: K) => Sort;

/**
 * Insert an element in the sorted associative list.
 */
export function insert<K, V>(cmp: Linorder<K>, key: K, value: V, list: AssocMap<K, V>): AssocMap<K, V> {
  if (list.length === 0) {
    return [[key, value]];
  }
  const [head, ...tail] = list;
  const [headKey, _] = head;
  switch (cmp(key, headKey)) {
    case "LowerThan":
      return [[key, value], head, ...tail];
    case "GreaterThan":
      return [head, ...insert(cmp, key, value, tail)];
    case "EqualTo":
      return [[key, value], ...tail];
  }
}

/**
 * Removes an element from the sorted associative list.
 */
export function remove<K, V>(cmp: Linorder<K>, key: K, list: AssocMap<K, V>): AssocMap<K, V> {
  if (list.length === 0) {
    return [];
  }
  const [head, ...tail] = list;
  const [headKey, _] = head;
  switch (cmp(key, headKey)) {
    case "EqualTo":
      return tail;
    case "GreaterThan":
      return [head, ...remove(cmp, key, tail)];
    case "LowerThan":
      return [head, ...tail];
  }
}

/**
 * Looks for an element in the sorted associative list.
 */
export function lookup<K, V>(cmp: Linorder<K>, key: K, list: AssocMap<K, V>): V | undefined {
  if (list.length === 0) {
    return undefined;
  }
  const [head, ...tail] = list;
  const [headKey, headValue] = head;
  switch (cmp(key, headKey)) {
    case "EqualTo":
      return headValue;
    case "GreaterThan":
      return lookup(cmp, key, tail);
    case "LowerThan":
      return undefined;
  }
}

/**
 * Looks for a value in the sorted associative list. If the value is not found, it returns the default value.
 */
export function findWithDefault<K, V>(cmp: Linorder<K>, defaultValue: V, key: K, list: AssocMap<K, V>): V {
  const value = lookup(cmp, key, list);
  return value === undefined ? defaultValue : value;
}

export function strCmp(a: string, b: string): Sort {
  if (a < b) {
    return "LowerThan";
  }
  if (a > b) {
    return "GreaterThan";
  }
  return "EqualTo";
}

export function member<K, V>(cmp: Linorder<K>, key: K, list: AssocMap<K, V>): boolean {
  return lookup(cmp, key, list) !== undefined;
}
