export function str(val: unknown): val is string {
  return typeof val == "string";
}

export function lit<S extends string>(v: S) {
  return function (val: unknown): val is S {
    return val === v;
  };
}

export function bool(val: unknown): val is boolean {
  return typeof val == "boolean";
}

export function num(val: unknown): val is number {
  return typeof val == "number";
}

export function bigint(val: unknown): val is bigint {
  return typeof val == "bigint";
}

export function unk(val: unknown): val is unknown {
  return true;
}

export type Guard<T> = (val: unknown) => val is T;

export type GuardOf<T extends Guard<any>> = T extends Guard<infer G>
  ? G
  : never;

export function arrayOf<T>(guard: Guard<T>) {
  return function (val: unknown): val is T[] {
    return Array.isArray(val) && val.every(guard);
  };
}

export type MapOfGuards = {
  [key: string]: Guard<any>;
};

type GuardObjOf<T extends MapOfGuards> = {
  [P in keyof T]: GuardOf<T[P]>;
};

export function objOf<T extends MapOfGuards>(guards: T) {
  return function (val: unknown): val is GuardObjOf<T> {
    if (typeof val !== "object" || val == null) return false;
    for (const prop in guards) {
      const guard = guards[prop];
      const val2 = val as any;
      if (!(prop in val2 && guard(val2[prop as string]))) {
        return false;
      }
      // if (!guard((val as any)[prop as string])) {
      //   return false;
      // }
    }
    return true;
  };
}

export function obj(val: unknown): val is Object {
  return typeof val == "object" && val != null;
}

export function assert<T>(guard: Guard<T>, val: unknown): asserts val is T {
  if (!guard(val)) {
    throw new Error("The object has an unexpected shape");
  }
}
