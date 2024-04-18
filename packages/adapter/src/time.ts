import * as t from "io-ts/lib/index.js";

export type ISO8601 = t.TypeOf<typeof ISO8601>;
export const ISO8601 = t.string;

// Epoch time in Milliseconds
export type POSIXTime = t.TypeOf<typeof POSIXTime>;
export const POSIXTime = t.bigint;

export const posixTimeToIso8601 = (posixTime: POSIXTime): ISO8601 => datetoIso8601(new Date(Number(posixTime)));

export const datetoIso8601 = (date: Date): ISO8601 => date.toISOString();

export const iso8601ToPosixTime = (iso8601: ISO8601): POSIXTime => BigInt(new Date(iso8601).getTime());

// a minute in milliseconds
export const MINUTES = 1000 * 60;

/**
 * Block the execution flow till a promise Predicate becomes true.
 * @param predicate
 * @param interval at which the predicate is re-evaluated
 * @returns
 */
export const waitForPredicatePromise = async (
  predicate: () => Promise<boolean>,
  seconds: number = 3
): Promise<void> => {
  if (await predicate()) {
    // Predicate is already true, no need to wait
    return;
  }
  // Use a promise to wait for the specified interval
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Wait for the specified interval
  await sleep(seconds);

  // Recursive call to continue checking the predicate
  await waitForPredicatePromise(predicate, seconds);
};

/**
 * Block the execution flow for a given number of seconds
 * @param secondes
 * @returns
 */
export const sleep = (seconds: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1_000));
};
