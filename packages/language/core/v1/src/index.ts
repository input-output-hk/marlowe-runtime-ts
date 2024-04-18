/**
 * This module is the main entrypoint for the language-core-v1 package. It offers static types and utility functions to work with
 * the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe Core Specification}.
 * The static types can only be used with TypeScript, but we offer the {@link @marlowe.io/language-core-v1!guards} module to check
 * at runtime if an object has the expected shape (which is useful for both JavaScript and TypeScript).

```
  import { Contract, Party, Value, lovelace, datetoTimeout } from "@marlowe.io/language-core-v1"

  // 1 Ada is equal to 1 Million lovelaces. The `n` at the end of the number is JavaScript way of
  // using bigint. Marlowe uses bigint to define Constant values.
  const oneADA: Value = 1000000n;

  // Other Marlowe datatypes are encoded as plain JSON objects as defined in the Appendix E of the Marlowe
  // Specification. For example, to express a MulValue object (multiplication), you need to define the
  // following JSON object
  const tenADA: Value = { multiply: 10n, times: oneADA };

  // Note that the explicit `: Value` type annotation is not strictly needed, the following line would
  // also work both in TypeScript and JavaScript
  // const tenADA = { multiply: 10n, times: oneADA};

  // The only difference is when we make a mistake. When we add the explicit annotation we inmediatly
  // get a compiler error close to the problematic code.

  // Try to modify "role_token" for "rle_token" in these expressions to see the difference.
  const bob: Party = { "role_token": "Bob" };
  const alice = { "role_token": "Alice" };

  const contract: Contract = {
    "when": [
      {
        "then": "close",
        "case": {
          "party": bob,
          "of_token": lovelace,
          "into_account": alice,
          "deposits": tenADA
        }
      }
    ],
    "timeout_continuation": "close",
    "timeout": datetoTimeout(new Date("2024-05-22"))
  }
```
 * @packageDocumentation
 */

export { Action, Deposit, Notify, Choice } from "./actions.js";
export { ChoiceName, ChoiceId, Bound, ChosenNum } from "./choices.js";
export {
  Close,
  Pay,
  If,
  Let,
  Assert,
  Contract,
  When,
  Case,
  NormalCase,
  MerkleizedCase,
  close,
  datetoTimeout,
  timeoutToDate,
  Timeout,
  getNextTimeout,
} from "./contract.js";
export { Environment, mkEnvironment, TimeInterval } from "./environment.js";

export {
  Input,
  IDeposit,
  IChoice,
  INotify,
  BuiltinByteString,
  inputNotify,
  InputContent,
  NormalInput,
  MerkleizedInput,
  MerkleizedDeposit,
  MerkleizedChoice,
  MerkleizedHashAndContinuation,
  MerkleizedNotify,
} from "./inputs.js";

export { role, Party, Address, Role, RoleName } from "./participants.js";

export { Payee, PayeeAccount, PayeeParty, AccountId } from "./payee.js";

export { Token, TokenName, tokenToString, token, adaToken, lovelace } from "./token.js";

export { Accounts, MarloweState } from "./state.js";

export {
  Value,
  ValueId,
  AvailableMoney,
  Constant,
  NegValue,
  AddValue,
  SubValue,
  MulValue,
  DivValue,
  ChoiceValue,
  TimeIntervalStart,
  TimeIntervalEnd,
  UseValue,
  Cond,
  Observation,
  AndObs,
  OrObs,
  NotObs,
  ChoseSomething,
  ValueEQ,
  ValueGT,
  ValueGE,
  ValueLT,
  ValueLE,
} from "./value-and-observation.js";

export { TokenValue, tokenValue, adaValue } from "./tokenValue.js";
export { PolicyId } from "./policyId.js";
