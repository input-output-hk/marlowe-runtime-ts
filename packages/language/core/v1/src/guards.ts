/**
  * This module offers {@link !io-ts-usage | dynamic type guards} for the for the JSON schema as specified in the Appendix E of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe specification}.
  ```
  import * as G from "@marlowe/language-core-v1/guards"
  const jsonObject = JSON.parse(fileContents)

  if (G.Contract.is(jsonObject)) {
    // The jsonObject respects the JSON schema for Contract
  } else {
    // The jsonObject does not respect the JSON schema for Contract
  }
  ```
  @packageDocumentation
 */

export { PolicyIdGuard as PolicyId } from "./policyId.js";

export {
  ActionGuard as Action,
  DepositGuard as Deposit,
  NotifyGuard as Notify,
  ChoiceGuard as Choice,
} from "./actions.js";

export { ChoiceNameGuard as ChoiceName, ChoiceIdGuard as ChoiceId, BoundGuard as Bound } from "./choices.js";

export {
  CloseGuard as Close,
  PayGuard as Pay,
  IfGuard as If,
  LetGuard as Let,
  AssertGuard as Assert,
  ContractGuard as Contract,
  WhenGuard as When,
  CaseGuard as Case,
  NormalCaseGuard as NormalCase,
  MerkleizedCaseGuard as MerkleizedCase,
  TimeoutGuard as Timeout,
} from "./contract.js";

export { EnvironmentGuard as Environment, TimeIntervalGuard as TimeInterval } from "./environment.js";

export {
  InputGuard as Input,
  IDepositGuard as IDeposit,
  IChoiceGuard as IChoice,
  INotifyGuard as INotify,
  BuiltinByteStringGuard as BuiltinByteString,
  InputContentGuard as InputContent,
  NormalInputGuard as NormalInput,
  MerkleizedInputGuard as MerkleizedInput,
} from "./inputs.js";

export {
  RoleGuard as Role,
  RoleNameGuard as RoleName,
  PartyGuard as Party,
  AddressGuard as Address,
} from "./participants.js";

export {
  PayeeGuard as Payee,
  PayeeAccountGuard as PayeeAccount,
  PayeePartyGuard as PayeeParty,
  AccountIdGuard as AccountId,
} from "./payee.js";

export { MarloweStateGuard as MarloweState, AccountsGuard as Accounts } from "./state.js";

export { TokenGuard as Token, TokenNameGuard as TokenName } from "./token.js";

export {
  ValueGuard as Value,
  ValueIdGuard as ValueId,
  AvailableMoneyGuard as AvailableMoney,
  ConstantGuard as Constant,
  NegValueGuard as NegValue,
  AddValueGuard as AddValue,
  SubValueGuard as SubValue,
  MulValueGuard as MulValue,
  DivValueGuard as DivValue,
  ChoiceValueGuard as ChoiceValue,
  TimeIntervalStartGuard as TimeIntervalStart,
  TimeIntervalEndGuard as TimeIntervalEnd,
  UseValueGuard as UseValue,
  CondGuard as Cond,
  ObservationGuard as Observation,
  AndObsGuard as AndObs,
  OrObsGuard as OrObs,
  NotObsGuard as NotObs,
  ChoseSomethingGuard as ChoseSomething,
  ValueEQGuard as ValueEQ,
  ValueGTGuard as ValueGT,
  ValueGEGuard as ValueGE,
  ValueLTGuard as ValueLT,
  ValueLEGuard as ValueLE,
} from "./value-and-observation.js";
export {
  TransactionGuard as Transaction,
  PaymentGuard as Payment,
  NonPositivePayGuard as NonPositivePay,
  NonPositiveDepositGuard as NonPositiveDeposit,
  PartialPayGuard as PartialPay,
  ShadowingGuard as Shadowing,
  AssertionFailedGuard as AssertionFailed,
  TransactionWarningGuard as TransactionWarning,
  InvalidIntervalGuard as InvalidInterval,
  IntervalInPastGuard as IntervalInPast,
  IntervalErrorGuard as IntervalError,
  AmbiguousTimeIntervalErrorGuard as AmbiguousTimeIntervalError,
  ApplyNoMatchErrorGuard as ApplyNoMatchError,
  UselessTransactionGuard as UselessTransaction,
  TEIntervalErrorGuard as TEIntervalError,
  TransactionErrorGuard as TransactionError,
  TransactionSuccessGuard as TransactionSuccess,
  TransactionOutputGuard as TransactionOutput,
} from "./transaction.js";
