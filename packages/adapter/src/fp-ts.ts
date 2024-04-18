/**
 * Unsafe utilties to remove fp-ts from the end user API.
 */
import * as E from "fp-ts/lib/Either.js";
import * as TE from "fp-ts/lib/TaskEither.js";

export function unsafeEither<E, A>(e: E.Either<E, A>) {
  return E.match(
    (err) => {
      throw err;
    },
    (res: A) => res
  )(e);
}

export async function unsafeTaskEither<E, A>(te: TE.TaskEither<E, A>) {
  const res = await te();
  return unsafeEither(res);
}

export function tryCatchDefault<A>(f: () => Promise<A>): TE.TaskEither<Error, A> {
  return TE.tryCatch(f, (err) => {
    if (err instanceof Error) return err;
    else return new Error(String(err));
  });
}
