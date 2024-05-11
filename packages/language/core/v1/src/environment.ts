import * as t from "io-ts/lib/index.js";
import { ISO8601, datetoIso8601, POSIXTime } from "@marlowe.io/adapter/time";

/**
 * @hidden
 */
// TODO: If this is supposed to be used by the end user it should be uncurried
export const mkEnvironment =
  (start: Date) =>
  (end: Date): Environment => ({
    timeInterval: { from: BigInt(start.getTime()), to: BigInt(end.getTime()) },
  });

/**
 * Time interval in which the contract is executed. It is defined by a start and end time. The time is represented as a POSIX time.
 * @see Appendix E.16 of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe specification}
 * @category Environment
 */
export interface TimeInterval {
  from: POSIXTime;
  to: POSIXTime;
}

/**
 * Guard for {@link TimeInterval}
 * @see Appendix E.16 of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe specification}
 * @category Environment
 */
export const TimeIntervalGuard: t.Type<TimeInterval> = t.type({
  from: POSIXTime,
  to: POSIXTime,
});

/**
 * Time interval in which the contract is executed.
 * @see Section 2.1.10 and appendix E.22 of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe specification}
 * @category Environment
 */
export interface Environment {
  timeInterval: TimeInterval;
}

/**
 * Guard for {@link Environment}
 * @see Section 2.1.10 and appendix E.22 of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe specification}
 * @category Environment
 */
export const EnvironmentGuard: t.Type<Environment> = t.type({
  timeInterval: TimeIntervalGuard,
});
