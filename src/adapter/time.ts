import * as t from "io-ts";
import { pipe } from "fp-ts/lib/function";
import { format, formatISO } from "date-fns";

export type ISO8601 = t.TypeOf<typeof ISO8601>
export const ISO8601 = t.string 

export type POSIXTime = t.TypeOf<typeof POSIXTime>
export const POSIXTime = t.number 


export const datetoIso8601 = (date:Date):ISO8601 => pipe(date,date => format (date,"yyyy-MM-dd'T'HH:mm:ss'Z'"))
export const datetoIso8601Bis = (date:Date):ISO8601 => pipe(date,formatISO)
