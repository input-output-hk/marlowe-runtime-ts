import * as t from "io-ts/lib/index.js";
import { Contract, ContractGuard } from "./contract.js";
import { TimeInterval, TimeIntervalGuard } from "./environment.js";
import { Input, InputGuard } from "./inputs.js";
import { Party, PartyGuard } from "./participants.js";
import { AccountId, AccountIdGuard, Payee, PayeeGuard } from "./payee.js";
import { MarloweState, MarloweStateGuard } from "./state.js";
import { Token, TokenGuard } from "./token.js";

/**
 * The Payment type represents the intention to transfer funds from the internal {@link AccountId}
 * to a {@link Payee}. This type is created as a result of executing a {@link index.Pay} statement and is
 * included as part of the output of {@link TransactionOutput |computing a transaction}.
 *
 * The {@link Payee} indicates whether the recipient of the payment is an internal account or external
 * participant. When we call {@link computeTransaction}, if the payment is internal, the funds are
 * transferred between internal state accounts. If the payment is external, the funds are removed from
 * the state account, and the contract makes the payment to the party.
 * @see Section 2.1.9 and appendix E.13 of the {@link https://github.com/input-output-hk/marlowe/releases/download/v3/Marlowe.pdf | Marlowe spec}
 * @category Transaction
 */
// TODO: Add note on payments to Role vs Address
export interface Payment {
  payment_from: AccountId;
  to: Payee;
  amount: bigint;
  token: Token;
}

/**
 * TODO: Comment
 * @category Transaction
 */
export const PaymentGuard: t.Type<Payment> = t.type({
  payment_from: AccountIdGuard,
  to: PayeeGuard,
  amount: t.bigint,
  token: TokenGuard,
});

/**
 * A marlowe transaction can consist of multiple inputs applied in a time interval
 * @category Transaction
 */
export interface Transaction {
  tx_interval: TimeInterval;
  tx_inputs: Input[];
}

/**
 * TODO: Comment
 * @category Transaction
 */
export const TransactionGuard: t.Type<Transaction> = t.type({
  tx_interval: TimeIntervalGuard,
  tx_inputs: t.array(InputGuard),
});

/**
 * In the marlowe specification we formally prove that computing a transaction of multiple inputs
 * in a time interval has the same semantics as computing multiple transactions of a single input.
 * Having an array of this data structure helps the developer to reason about what inputs were applied
 * to a contract, without caring if they were applied in a single transaction or in multiple ones.
 * @category Transaction
 */
export interface SingleInputTx {
  interval: TimeInterval;
  /** If the input is undefined, the transaction was used to reduce a non quiesent contract.
      This can happen to advance a timeout or if the contract doesn't start with a When
  */
  input?: Input;
}

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export interface NonPositiveDeposit {
  party: Party;
  asked_to_deposit: bigint;
  of_token: Token;
  in_account: AccountId;
}

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export const NonPositiveDepositGuard: t.Type<NonPositiveDeposit> = t.type({
  party: PartyGuard,
  asked_to_deposit: t.bigint,
  of_token: TokenGuard,
  in_account: AccountIdGuard,
});

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export interface NonPositivePay {
  account: AccountId;
  asked_to_pay: bigint;
  of_token: Token;
  to_payee: Payee;
}

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export const NonPositivePayGuard: t.Type<NonPositivePay> = t.type({
  account: AccountIdGuard,
  asked_to_pay: t.bigint,
  of_token: TokenGuard,
  to_payee: PayeeGuard,
});

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export interface PartialPay {
  account: AccountId;
  asked_to_pay: bigint;
  of_token: Token;
  to_payee: Payee;
  but_only_paid: bigint;
}

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export const PartialPayGuard: t.Type<PartialPay> = t.type({
  account: AccountIdGuard,
  asked_to_pay: t.bigint,
  of_token: TokenGuard,
  to_payee: PayeeGuard,
  but_only_paid: t.bigint,
});

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export interface Shadowing {
  value_id: string;
  had_value: bigint;
  is_now_assigned: bigint;
}

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export const ShadowingGuard: t.Type<Shadowing> = t.type({
  value_id: t.string,
  had_value: t.bigint,
  is_now_assigned: t.bigint,
});

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export type AssertionFailed = "assertion_failed";

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export const AssertionFailedGuard: t.Type<AssertionFailed> = t.literal("assertion_failed");

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export type TransactionWarning = NonPositiveDeposit | NonPositivePay | PartialPay | Shadowing | AssertionFailed;

/**
 * TODO: Comment
 * @category Transaction Warning
 */
export const TransactionWarningGuard: t.Type<TransactionWarning> = t.union([
  NonPositiveDepositGuard,
  NonPositivePayGuard,
  PartialPayGuard,
  ShadowingGuard,
  AssertionFailedGuard,
]);

/**
 * TODO: Comment
 * @category Transaction Error
 */
export interface InvalidInterval {
  invalidInterval: { from: bigint; to: bigint };
}

/**
 * TODO: Comment
 * @category Transaction Error
 */
export const InvalidIntervalGuard: t.Type<InvalidInterval> = t.type({
  invalidInterval: t.type({ from: t.bigint, to: t.bigint }),
});

/**
 * TODO: Comment
 * @category Transaction Error
 */
export interface IntervalInPast {
  intervalInPastError: { from: bigint; to: bigint; minTime: bigint };
}

/**
 * TODO: Comment
 * @category Transaction Error
 */
export const IntervalInPastGuard: t.Type<IntervalInPast> = t.type({
  intervalInPastError: t.type({
    from: t.bigint,
    to: t.bigint,
    minTime: t.bigint,
  }),
});

/**
 * TODO: Comment
 * @category Transaction Error
 */
export type IntervalError = InvalidInterval | IntervalInPast;
export const IntervalErrorGuard: t.Type<IntervalError> = t.union([InvalidIntervalGuard, IntervalInPastGuard]);

/**
 * TODO: Comment
 * @category Transaction Error
 */
export type AmbiguousTimeIntervalError = "TEAmbiguousTimeIntervalError";

/**
 * TODO: Comment
 * @category Transaction Error
 */
export const AmbiguousTimeIntervalErrorGuard: t.Type<AmbiguousTimeIntervalError> =
  t.literal("TEAmbiguousTimeIntervalError");

/**
 * TODO: Comment
 * @category Transaction Error
 */
export type ApplyNoMatchError = "TEApplyNoMatchError";

/**
 * TODO: Comment
 * @category Transaction Error
 */
export const ApplyNoMatchErrorGuard: t.Type<ApplyNoMatchError> = t.literal("TEApplyNoMatchError");

/**
 * TODO: Comment
 * @category Transaction Error
 */
export type UselessTransaction = "TEUselessTransaction";

/**
 * TODO: Comment
 * @category Transaction Error
 */
export const UselessTransactionGuard: t.Type<UselessTransaction> = t.literal("TEUselessTransaction");

/**
 * TODO: Comment
 * @category Transaction Error
 */
export type HashMismatchError = "TEHashMismatch";

/**
 * TODO: Comment
 * @category Transaction Error
 */
export const HashMismatchErrorGuard: t.Type<HashMismatchError> = t.literal("TEHashMismatch");

/**
 * TODO: Comment
 * @category Transaction Error
 */
export interface TEIntervalError {
  error: "TEIntervalError";
  context: IntervalError;
}

/**
 * TODO: Comment
 * @category Transaction Error
 */
export const TEIntervalErrorGuard: t.Type<TEIntervalError> = t.type({
  error: t.literal("TEIntervalError"),
  context: IntervalErrorGuard,
});

/**
 * TODO: Comment
 * @category Transaction Error
 */
export type TransactionError =
  | AmbiguousTimeIntervalError
  | ApplyNoMatchError
  | UselessTransaction
  | TEIntervalError
  | HashMismatchError;

/**
 * TODO: Comment
 * @category Transaction Error
 */
export const TransactionErrorGuard: t.Type<TransactionError> = t.union([
  AmbiguousTimeIntervalErrorGuard,
  ApplyNoMatchErrorGuard,
  UselessTransactionGuard,
  TEIntervalErrorGuard,
  HashMismatchErrorGuard,
]);

/**
 * TODO: Comment
 * @category Transaction
 */
export interface TransactionSuccess {
  warnings: TransactionWarning[];
  payments: Payment[];
  state: MarloweState;
  contract: Contract;
}

/**
 * TODO: Comment
 * @category Transaction
 */
export const TransactionSuccessGuard: t.Type<TransactionSuccess> = t.type({
  warnings: t.array(TransactionWarningGuard),
  payments: t.array(PaymentGuard),
  state: MarloweStateGuard,
  contract: ContractGuard,
});

/**
 * TODO: Comment
 * @category Transaction
 */
export type TransactionOutput = TransactionSuccess | { transaction_error: TransactionError };

/**
 * TODO: Comment
 * @category Transaction
 */
export const TransactionOutputGuard: t.Type<TransactionOutput> = t.union([
  TransactionSuccessGuard,
  t.type({ transaction_error: TransactionErrorGuard }),
]);
