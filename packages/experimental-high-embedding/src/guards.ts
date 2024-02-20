import * as ObjG from "@marlowe.io/marlowe-object/guards";
import * as Obj from "@marlowe.io/marlowe-object";
import { subtypeUnion } from "@marlowe.io/adapter/io-ts";

import * as t from "io-ts/lib/index.js";
import * as Either from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";

import * as HOM from "./hom.js";
import { unsafeEither } from "@marlowe.io/adapter/fp-ts";

export const RoleGuard = ObjG.Role.pipe(
  new t.Type<HOM.RoleParty, Obj.Role, Obj.Role>(
    "RoleFromObject",
    (u): u is HOM.RoleParty => u instanceof HOM.RoleParty,
    (u, c) => {
      return t.success(new HOM.RoleParty(u.role_token));
    },
    (a) => ({ role_token: a.roleName })
  )
);

export const AddressGuard = ObjG.Address.pipe(
  new t.Type<HOM.AddressParty, Obj.Address, Obj.Address>(
    "AddressFromObject",
    (u): u is HOM.AddressParty => u instanceof HOM.AddressParty,
    (u, c) => {
      return t.success(new HOM.AddressParty(u.address));
    },
    (a) => ({ address: a.address })
  )
);

export const PartyGuard: t.Type<HOM.Party, Obj.Party, unknown> = t.recursion(
  "Party",
  () => subtypeUnion("Party", HOM.Party, [AddressGuard, RoleGuard])
);

export const PartyPayeeGuard = ObjG.PayeeParty.pipe(
  new t.Type<HOM.PartyPayee, Obj.PayeeParty, Obj.PayeeParty>(
    "PartyPayeeFromObject",
    (u): u is HOM.PartyPayee => u instanceof HOM.PartyPayee,
    (u, c) =>
      pipe(
        PartyGuard.validate(u.party, c),
        Either.map((party) => new HOM.PartyPayee(party))
      ),
    (a) => ({ party: PartyGuard.encode(a.party) })
  )
);

export const AccountPayeeGuard = ObjG.PayeeAccount.pipe(
  new t.Type<HOM.AccountPayee, Obj.PayeeAccount, Obj.PayeeAccount>(
    "AccountFromObject",
    (u): u is HOM.AccountPayee => u instanceof HOM.AccountPayee,
    (u, c) => {
      return pipe(
        PartyGuard.validate(u.account, c),
        Either.map((account) => new HOM.AccountPayee(account))
      );
    },
    (a) => ({ account: PartyGuard.encode(a.account) })
  )
);

export const PayeeGuard: t.Type<HOM.Payee, Obj.Payee, unknown> = t.recursion(
  "Payee",
  () => subtypeUnion("Payee", HOM.Payee, [AccountPayeeGuard, PartyPayeeGuard])
);

export const ChoiceIdGuard = ObjG.ChoiceId.pipe(
  new t.Type<HOM.ChoiceId, Obj.ChoiceId, Obj.ChoiceId>(
    "ChoiceIdFromObject",
    (u): u is HOM.ChoiceId => u instanceof HOM.ChoiceId,
    (u, ctx) => {
      return pipe(
        PartyGuard.validate(u.choice_owner, ctx),
        Either.map((party) => new HOM.ChoiceId(u.choice_name, party))
      );
    },
    (a) => ({
      choice_name: a.choiceName,
      choice_owner: PartyGuard.encode(a.choiceOwner),
    })
  )
);

export const BoundGuard = ObjG.Bound;

export const TokenGuard = ObjG.Token.pipe(
  new t.Type<HOM.Token, Obj.Token, Obj.Token>(
    "TokenFromObject",
    (u): u is HOM.Token => u instanceof HOM.Token,
    (u, c) => {
      if ("currency_symbol" in u) {
        return t.success(new HOM.Token(u.currency_symbol, u.token_name));
      } else {
        return t.failure<HOM.Token>(
          u,
          c,
          "Token reference decoding is not implemented. "
        );
      }
    },
    (a) => ({ currency_symbol: a.currencySymbol, token_name: a.tokenName })
  )
);

export const AvailableMoneyGuard = ObjG.AvailableMoney.pipe(
  new t.Type<HOM.AvailableMoneyValue, Obj.AvailableMoney, Obj.AvailableMoney>(
    "AvailableMoneyFromObject",
    (u): u is HOM.AvailableMoneyValue => u instanceof HOM.AvailableMoneyValue,
    (u, c) =>
      pipe(
        Either.Do,
        Either.apS("in_account", PartyGuard.validate(u.in_account, c)),
        Either.apS(
          "amount_of_token",
          TokenGuard.validate(u.amount_of_token, c)
        ),
        Either.map(
          (party) =>
            new HOM.AvailableMoneyValue(party.in_account, party.amount_of_token)
        )
      ),
    (a) => ({
      amount_of_token: TokenGuard.encode(a.token),
      in_account: PartyGuard.encode(a.accountId),
    })
  )
);

export const ChoiceValueGuard = ObjG.ChoiceValue.pipe(
  new t.Type<HOM.ChoiceValueValue, Obj.ChoiceValue, Obj.ChoiceValue>(
    "ChoiceValueFromObject",
    (u): u is HOM.ChoiceValueValue => u instanceof HOM.ChoiceValueValue,
    (u, c) =>
      pipe(
        ChoiceIdGuard.validate(u.value_of_choice, c),
        Either.map((choiceId) => new HOM.ChoiceValueValue(choiceId))
      ),
    (a) => ({ value_of_choice: ChoiceIdGuard.encode(a.choiceId) })
  )
);

export const ConstantGuard = ObjG.Constant.pipe(
  new t.Type<HOM.ConstantValue, Obj.Constant, Obj.Constant>(
    "ConstantFromObject",
    (u): u is HOM.ConstantValue => u instanceof HOM.ConstantValue,
    (u, c) => {
      return t.success(new HOM.ConstantValue(u));
    },
    (a) => a.val
  )
);

export const NegGuard = ObjG.NegValue.pipe(
  new t.Type<HOM.NegValue, Obj.NegValue, Obj.NegValue>(
    "NegValueFromObject",
    (u): u is HOM.NegValue => u instanceof HOM.NegValue,
    (u, ctx) => {
      return pipe(
        ValueGuard.validate(u.negate, ctx),
        Either.map((val) => new HOM.NegValue(val))
      );
    },
    (a) => ({ negate: ValueGuard.encode(a.val) })
  )
);

export const AddGuard = ObjG.AddValue.pipe(
  new t.Type<HOM.AddValue, Obj.AddValue, Obj.AddValue>(
    "AddValueFromObject",
    (u): u is HOM.AddValue => u instanceof HOM.AddValue,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("add", ValueGuard.validate(u.add, ctx)),
        Either.apS("and", ValueGuard.validate(u.and, ctx)),
        Either.map((val) => new HOM.AddValue(val.add, val.and))
      ),
    (a) => ({ add: ValueGuard.encode(a.left), and: ValueGuard.encode(a.right) })
  )
);

export const SubValueGuard = ObjG.SubValue.pipe(
  new t.Type<HOM.SubValue, Obj.SubValue, Obj.SubValue>(
    "SubValueFromObject",
    (u): u is HOM.SubValue => u instanceof HOM.SubValue,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("minus", ValueGuard.validate(u.minus, ctx)),
        Either.map((val) => new HOM.SubValue(val.value, val.minus))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      minus: ValueGuard.encode(a.right),
    })
  )
);

export const MulValueGuard = ObjG.MulValue.pipe(
  new t.Type<HOM.MulValue, Obj.MulValue, Obj.MulValue>(
    "MulValueFromObject",
    (u): u is HOM.MulValue => u instanceof HOM.MulValue,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("multiply", ValueGuard.validate(u.multiply, ctx)),
        Either.apS("times", ValueGuard.validate(u.times, ctx)),
        Either.map((val) => new HOM.MulValue(val.multiply, val.times))
      ),
    (a) => ({
      multiply: ValueGuard.encode(a.left),
      times: ValueGuard.encode(a.right),
    })
  )
);

export const DivValueGuard = ObjG.DivValue.pipe(
  new t.Type<HOM.DivValue, Obj.DivValue, Obj.DivValue>(
    "DivValueFromObject",
    (u): u is HOM.DivValue => u instanceof HOM.DivValue,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("divide", ValueGuard.validate(u.divide, ctx)),
        Either.apS("by", ValueGuard.validate(u.by, ctx)),
        Either.map((val) => new HOM.DivValue(val.divide, val.by))
      ),
    (a) => ({
      divide: ValueGuard.encode(a.divide),
      by: ValueGuard.encode(a.by),
    })
  )
);

export const UseValueGuard = ObjG.UseValue.pipe(
  new t.Type<HOM.UseValue, Obj.UseValue, Obj.UseValue>(
    "UseValueFromObject",
    (u): u is HOM.UseValue => u instanceof HOM.UseValue,
    (u, ctx) => {
      return t.success(new HOM.UseValue(u.use_value));
    },
    (a) => ({ use_value: a.valueId })
  )
);

export const CondGuard = ObjG.Cond.pipe(
  new t.Type<HOM.CondValue, Obj.Cond, Obj.Cond>(
    "CondFromObject",
    (u): u is HOM.CondValue => u instanceof HOM.CondValue,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("if", ObservationGuard.validate(u.if, ctx)),
        Either.apS("then", ValueGuard.validate(u.then, ctx)),
        Either.apS("else", ValueGuard.validate(u.else, ctx)),
        Either.map((val) => new HOM.CondValue(val.if, val.then, val.else))
      ),
    (a) => ({
      if: ObservationGuard.encode(a.obs),
      then: ValueGuard.encode(a.ifTrue),
      else: ValueGuard.encode(a.ifFalse),
    })
  )
);

export const TimeIntervalStartGuard = ObjG.TimeIntervalStart.pipe(
  new t.Type<
    HOM.TimeIntervalStartValue,
    Obj.TimeIntervalStart,
    Obj.TimeIntervalStart
  >(
    "TimeIntervalStartFromObject",
    (u): u is HOM.TimeIntervalStartValue =>
      u instanceof HOM.TimeIntervalStartValue,
    (u, ctx) => {
      return t.success(new HOM.TimeIntervalStartValue());
    },
    (a) => "time_interval_start"
  )
);

export const TimeIntervalEndGuard = ObjG.TimeIntervalEnd.pipe(
  new t.Type<
    HOM.TimeIntervalEndValue,
    Obj.TimeIntervalEnd,
    Obj.TimeIntervalEnd
  >(
    "TimeIntervalEndFromObject",
    (u): u is HOM.TimeIntervalEndValue => u instanceof HOM.TimeIntervalEndValue,
    (u, ctx) => {
      return t.success(new HOM.TimeIntervalEndValue());
    },
    (a) => "time_interval_end"
  )
);

export const ValueGuard: t.Type<HOM.Value, Obj.Value, unknown> = t.recursion(
  "Value",
  () =>
    subtypeUnion("Value", HOM.Value, [
      ConstantGuard,
      AvailableMoneyGuard,
      ChoiceValueGuard,
      NegGuard,
      AddGuard,
      SubValueGuard,
      MulValueGuard,
      DivValueGuard,
      UseValueGuard,
      CondGuard,
      TimeIntervalStartGuard,
      TimeIntervalEndGuard,
    ])
);

export const AndObsGuard = ObjG.AndObs.pipe(
  new t.Type<HOM.AndObs, Obj.AndObs, Obj.AndObs>(
    "AndObsFromObject",
    (u): u is HOM.AndObs => u instanceof HOM.AndObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("both", ObservationGuard.validate(u.both, ctx)),
        Either.apS("and", ObservationGuard.validate(u.and, ctx)),
        Either.map((val) => new HOM.AndObs(val.both, val.and))
      ),
    (a) => ({
      both: ObservationGuard.encode(a.left),
      and: ObservationGuard.encode(a.right),
    })
  )
);

export const OrObsGuard = ObjG.OrObs.pipe(
  new t.Type<HOM.OrObs, Obj.OrObs, Obj.OrObs>(
    "OrObsFromObject",
    (u): u is HOM.OrObs => u instanceof HOM.OrObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("either", ObservationGuard.validate(u.either, ctx)),
        Either.apS("or", ObservationGuard.validate(u.or, ctx)),
        Either.map((val) => new HOM.OrObs(val.either, val.or))
      ),
    (a) => ({
      either: ObservationGuard.encode(a.left),
      or: ObservationGuard.encode(a.right),
    })
  )
);

export const NotObsGuard = ObjG.NotObs.pipe(
  new t.Type<HOM.NotObs, Obj.NotObs, Obj.NotObs>(
    "NotObsFromObject",
    (u): u is HOM.NotObs => u instanceof HOM.NotObs,
    (u, ctx) =>
      pipe(
        ObservationGuard.validate(u.not, ctx),
        Either.map((val) => new HOM.NotObs(val))
      ),
    (a) => ({ not: ObservationGuard.encode(a.val) })
  )
);

export const ValueEqGuard = ObjG.ValueEQ.pipe(
  new t.Type<HOM.ValueEq, Obj.ValueEQ, Obj.ValueEQ>(
    "ValueEqFromObject",
    (u): u is HOM.ValueEq => u instanceof HOM.ValueEq,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("equal_to", ValueGuard.validate(u.equal_to, ctx)),
        Either.map((val) => new HOM.ValueEq(val.value, val.equal_to))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      equal_to: ValueGuard.encode(a.right),
    })
  )
);

export const ValueGEObsGuard = ObjG.ValueGE.pipe(
  new t.Type<HOM.ValueGEObs, Obj.ValueGE, Obj.ValueGE>(
    "ValueGEFromObject",
    (u): u is HOM.ValueGEObs => u instanceof HOM.ValueGEObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("ge_than", ValueGuard.validate(u.ge_than, ctx)),
        Either.map((val) => new HOM.ValueGEObs(val.value, val.ge_than))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      ge_than: ValueGuard.encode(a.right),
    })
  )
);

export const ValueGTObsGuard = ObjG.ValueGT.pipe(
  new t.Type<HOM.ValueGTObs, Obj.ValueGT, Obj.ValueGT>(
    "ValueGTFromObject",
    (u): u is HOM.ValueGTObs => u instanceof HOM.ValueGTObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("gt", ValueGuard.validate(u.gt, ctx)),
        Either.map((val) => new HOM.ValueGTObs(val.value, val.gt))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      gt: ValueGuard.encode(a.right),
    })
  )
);

export const ValueLTObsGuard = ObjG.ValueLT.pipe(
  new t.Type<HOM.ValueLTObs, Obj.ValueLT, Obj.ValueLT>(
    "ValueLTFromObject",
    (u): u is HOM.ValueLTObs => u instanceof HOM.ValueLTObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("lt_than", ValueGuard.validate(u.lt, ctx)),
        Either.map((val) => new HOM.ValueLTObs(val.value, val.lt_than))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      lt: ValueGuard.encode(a.right),
    })
  )
);

export const ValueLEObsGuard = ObjG.ValueLE.pipe(
  new t.Type<HOM.ValueLEObs, Obj.ValueLE, Obj.ValueLE>(
    "ValueLEFromObject",
    (u): u is HOM.ValueLEObs => u instanceof HOM.ValueLEObs,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("value", ValueGuard.validate(u.value, ctx)),
        Either.apS("le_than", ValueGuard.validate(u.le_than, ctx)),
        Either.map((val) => new HOM.ValueLEObs(val.value, val.le_than))
      ),
    (a) => ({
      value: ValueGuard.encode(a.left),
      le_than: ValueGuard.encode(a.right),
    })
  )
);

export const ChoseSomethingGuard = ObjG.ChoseSomething.pipe(
  new t.Type<HOM.ChoseSomething, Obj.ChoseSomething, Obj.ChoseSomething>(
    "ChoseSomethingFromObject",
    (u): u is HOM.ChoseSomething => u instanceof HOM.ChoseSomething,
    (u, ctx) =>
      pipe(
        ChoiceIdGuard.validate(u.chose_something_for, ctx),
        Either.map((val) => new HOM.ChoseSomething(val))
      ),
    (a) => ({ chose_something_for: ChoiceIdGuard.encode(a.choiceId) })
  )
);

export const ConstantObsGuard = t.boolean.pipe(
  new t.Type<HOM.ConstantObs, boolean, boolean>(
    "ConstantObs",
    (u): u is HOM.ConstantObs => u instanceof HOM.ConstantObs,
    (u, c) => {
      return t.success(new HOM.ConstantObs(u));
    },
    (a) => a.obs
  )
);

export const ObservationGuard: t.Type<
  HOM.Observation,
  Obj.Observation,
  unknown
> = t.recursion("Observation", () =>
  subtypeUnion("Observation", HOM.Observation, [
    ConstantObsGuard,
    AndObsGuard,
    OrObsGuard,
    NotObsGuard,
    ValueEqGuard,
    ValueGEObsGuard,
    ValueGTObsGuard,
    ValueLTObsGuard,
    ValueLEObsGuard,
    ChoseSomethingGuard,
  ])
);

export const PayGuard = ObjG.Pay.pipe(
  new t.Type<HOM.Pay, Obj.Pay<unknown>, Obj.Pay<unknown>>(
    "PayFromObject",
    (u): u is HOM.Pay => u instanceof HOM.Pay,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("from_account", PartyGuard.validate(u.from_account, ctx)),
        Either.apS("to", PayeeGuard.validate(u.to, ctx)),
        Either.apS("token", TokenGuard.validate(u.token, ctx)),
        Either.apS("pay", ValueGuard.validate(u.pay, ctx)),
        Either.apS("then", ContractGuard.validate(u.then, ctx)),
        Either.map(
          (val) =>
            new HOM.Pay(val.from_account, val.to, val.token, val.pay, val.then)
        )
      ),
    (a) => {
      a.__build();
      return {
        from_account: PartyGuard.encode(a.from),
        to: PayeeGuard.encode(a.to),
        token: TokenGuard.encode(a.token),
        pay: ValueGuard.encode(a.value),
        then: ContractGuard.encode(a.cont),
      };
    }
  )
);

export const AssertGuard = ObjG.Assert.pipe(
  new t.Type<HOM.Assert, Obj.Assert<unknown>, Obj.Assert<unknown>>(
    "AssertFromObject",
    (u): u is HOM.Assert => u instanceof HOM.Assert,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("assert", ObservationGuard.validate(u.assert, ctx)),
        Either.apS("then", ContractGuard.validate(u.then, ctx)),
        Either.map((val) => new HOM.Assert(val.assert, val.then))
      ),
    (a) => {
      a.__build();
      return {
        assert: ObservationGuard.encode(a.obs),
        then: ContractGuard.encode(a.cont),
      };
    }
  )
);

export const LetGuard = ObjG.Let.pipe(
  new t.Type<HOM.Let, Obj.Let<unknown>, Obj.Let<unknown>>(
    "LetFromObject",
    (u): u is HOM.Let => u instanceof HOM.Let,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("let", t.string.validate(u.let, ctx)),
        Either.apS("be", ValueGuard.validate(u.be, ctx)),
        Either.apS("then", ContractGuard.validate(u.then, ctx)),
        Either.map((val) => new HOM.Let(val.let, val.be, val.then))
      ),
    (a) => {
      a.__build();
      return {
        let: a.valueId,
        be: ValueGuard.encode(a.value),
        then: ContractGuard.encode(a.cont),
      };
    }
  )
);

export const IfGuard = ObjG.If.pipe(
  new t.Type<HOM.If, Obj.If<unknown>, Obj.If<unknown>>(
    "IfFromObject",
    (u): u is HOM.If => u instanceof HOM.If,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("if", ObservationGuard.validate(u.if, ctx)),
        Either.apS("then", ContractGuard.validate(u.then, ctx)),
        Either.apS("else", ContractGuard.validate(u.else, ctx)),
        Either.map((val) => new HOM.If(val.if, val.then, val.else))
      ),
    (a) => {
      a.__build();
      return {
        if: ObservationGuard.encode(a.obs),
        then: ContractGuard.encode(a.ifTrue),
        else: ContractGuard.encode(a.ifFalse),
      };
    }
  )
);

export const NormalCaseGuard = ObjG.NormalCase.pipe(
  new t.Type<HOM.NormalCase, Obj.NormalCase<unknown>, Obj.NormalCase<unknown>>(
    "NormalCaseFromObject",
    (u): u is HOM.NormalCase => u instanceof HOM.NormalCase,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("case", ActionGuard.validate(u.case, ctx)),
        Either.apS("then", ContractGuard.validate(u.then, ctx)),
        Either.map((val) => new HOM.NormalCase(val.case, val.then))
      ),
    (a) => {
      a.__build();
      return {
        case: ActionGuard.encode(a.action),
        then: ContractGuard.encode(a.cont),
      };
    }
  )
);

// FIXME
// export const MerkleizedCaseGuard = ObjG.MerkleizedCase.pipe(
//   new t.Type<MerkleizedCase, Obj.NormalCase<unknown>, Obj.NormalCase<unknown>>(
//     "MerkleizedCaseFromObject",
//     (u): u is MerkleizedCase => u instanceof MerkleizedCase,
//     (u, ctx) => t.failure(u, ctx, "Not implemented"),
//       // pipe(
//       //   Either.Do,
//       //   Either.apS("case", ActionGuard.validate(u.case, ctx)),
//       //   Either.apS("then", ContractGuard.validate(u.then, ctx)),
//       //   Either.map((val) => new MerkleizedCase(val.case, val.then))
//       // ),
//     (a) => ({
//       case: ActionGuard.encode(a.action),
//       then: ContractGuard.encode(a.cont),
//     })
//   ));

export const CaseGuard: t.Type<
  HOM.Case,
  Obj.Case<unknown>,
  unknown
> = t.recursion("Case", () =>
  subtypeUnion("Case", HOM.Case, [NormalCaseGuard])
);

export const NotifyActionGuard = ObjG.Notify.pipe(
  new t.Type<HOM.NotifyAction, Obj.Notify, Obj.Notify>(
    "NotifyFromObject",
    (u): u is HOM.NotifyAction => u instanceof HOM.NotifyAction,
    (u, ctx) =>
      pipe(
        ObservationGuard.validate(u.notify_if, ctx),
        Either.map((val) => new HOM.NotifyAction(val))
      ),
    (a) => ({ notify_if: ObservationGuard.encode(a.observation) })
  )
);

export const DepositActionGuard = ObjG.Deposit.pipe(
  new t.Type<HOM.DepositAction, Obj.Deposit, Obj.Deposit>(
    "DepositFromObject",
    (u): u is HOM.DepositAction => u instanceof HOM.DepositAction,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("deposits", ValueGuard.validate(u.deposits, ctx)),
        Either.apS("into_account", PartyGuard.validate(u.into_account, ctx)),
        Either.apS("of_token", TokenGuard.validate(u.of_token, ctx)),
        Either.apS("party", PartyGuard.validate(u.party, ctx)),
        Either.map(
          (val) =>
            new HOM.DepositAction(
              val.into_account,
              val.party,
              val.of_token,
              val.deposits
            )
        )
      ),
    (a) => ({
      deposits: ValueGuard.encode(a.value),
      into_account: PartyGuard.encode(a.intoAccount),
      of_token: TokenGuard.encode(a.token),
      party: PartyGuard.encode(a.from),
    })
  )
);

export const ChoiceActionGuard = ObjG.Choice.pipe(
  new t.Type<HOM.ChoiceAction, Obj.Choice, Obj.Choice>(
    "ChoiceFromObject",
    (u): u is HOM.ChoiceAction => u instanceof HOM.ChoiceAction,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("for_choice", ChoiceIdGuard.validate(u.for_choice, ctx)),
        Either.apS(
          "choose_between",
          t.array(BoundGuard).validate(u.choose_between, ctx)
        ),
        Either.map(
          (val) => new HOM.ChoiceAction(val.for_choice, val.choose_between)
        )
      ),
    (a) => ({
      for_choice: ChoiceIdGuard.encode(a.choiceId),
      choose_between: a.bounds.map(BoundGuard.encode),
    })
  )
);

export const ActionGuard: t.Type<HOM.Action, Obj.Action, unknown> = t.recursion(
  "Action",
  () =>
    subtypeUnion("Action", HOM.Action, [
      NotifyActionGuard,
      DepositActionGuard,
      ChoiceActionGuard,
    ])
);

export const WhenGuard = ObjG.When.pipe(
  new t.Type<HOM.When, Obj.When<unknown>, Obj.When<unknown>>(
    "WhenFromObject",
    (u): u is HOM.When => u instanceof HOM.When,
    (u, ctx) =>
      pipe(
        Either.Do,
        Either.apS("when", t.array(CaseGuard).validate(u.when, ctx)),
        Either.apS("timeout", t.bigint.validate(u.timeout, ctx)),
        Either.apS(
          "timeout_continuation",
          ContractGuard.validate(u.timeout_continuation, ctx)
        ),
        Either.map(
          (val) =>
            new HOM.When(val.when).after(
              new Date(Number(val.timeout)),
              val.timeout_continuation
            ) as HOM.When
        )
      ),
    (a) => {
      a.__build();
      const contingency =
        a.contingency || a.defaultContingency || HOM.defaultContingency;
      return {
        when: a.cases.map(CaseGuard.encode),
        timeout: BigInt(contingency[0].getTime()),
        timeout_continuation: ContractGuard.encode(contingency[1]),
      };
    }
  )
);

export const CloseGuard = ObjG.Close.pipe(
  new t.Type<HOM.Close, Obj.Close<unknown>, Obj.Close<unknown>>(
    "CloseFromObject",
    (u): u is HOM.Close => u instanceof HOM.Close,
    (u, ctx) => {
      return t.success(new HOM.Close());
    },
    (a) => "close"
  )
);

export const ContractGuard: t.Type<
  HOM.Contract,
  Obj.Contract<unknown>,
  unknown
> = t.recursion("Contract", () =>
  subtypeUnion("Contract", HOM.Contract, [
    CloseGuard,
    PayGuard,
    IfGuard,
    WhenGuard,
    LetGuard,
    AssertGuard,
  ])
);

export function parseBound(obj: unknown): HOM.Bound {
  return unsafeEither(BoundGuard.decode(obj));
}

export function parseValue(obj: unknown): HOM.Value {
  return unsafeEither(ValueGuard.decode(obj));
}

export function parseToken(obj: unknown): HOM.Token {
  return unsafeEither(TokenGuard.decode(obj));
}

export function parseParty(obj: unknown): HOM.Party {
  return unsafeEither(PartyGuard.decode(obj));
}

export function parsePayee(obj: unknown): HOM.Payee {
  return unsafeEither(PayeeGuard.decode(obj));
}

export function parseChoiceId(obj: unknown): HOM.ChoiceId {
  return unsafeEither(ChoiceIdGuard.decode(obj));
}

export function parseObservation(obj: unknown): HOM.Observation {
  return unsafeEither(ObservationGuard.decode(obj));
}

export function parseAction(obj: unknown): HOM.Action {
  return unsafeEither(ActionGuard.decode(obj));
}

export function parseContract(obj: unknown): HOM.Contract {
  return unsafeEither(ContractGuard.decode(obj));
}
