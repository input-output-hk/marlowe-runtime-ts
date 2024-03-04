import { Cond } from "@marlowe.io/language-core-v1";
import * as HOM from "./hom.js";

export function Role(roleName: string) {
  return new HOM.RoleParty(roleName);
}

export function Address(address: string) {
  return new HOM.AddressParty(address);
}

// TODO: Revisit casing, why not uppercase?
export function account(p: HOM.Party) {
  return new HOM.AccountPayee(p);
}

// TODO: Revisit casing, why not uppercase?
export function party(p: HOM.Party) {
  return new HOM.PartyPayee(p);
}

export function choiceId(
  choiceName: string,
  choiceOwner: HOM.Party
): HOM.ChoiceId {
  return new HOM.ChoiceId(choiceName, choiceOwner);
}

export function choiceValue(
  choiceName: string,
  choiceOwner: HOM.Party
): HOM.ChoiceValueValue {
  return choiceId(choiceName, choiceOwner).value();
}

export function Bound(from: bigint, to: bigint): HOM.Bound {
  return { from, to };
}

export function AvailableMoney(accountId: HOM.Party, token: HOM.Token) {
  return new HOM.AvailableMoneyValue(accountId, token);
}

export function Constant(n: number | bigint) {
  return new HOM.ConstantValue(BigInt(n));
}

export function Neg(val: HOM.ValueOrNumber) {
  return new HOM.NegValue(val);
}

export function Add(left: HOM.ValueOrNumber, right: HOM.ValueOrNumber) {
  return new HOM.AddValue(left, right);
}

export function Sub(left: HOM.ValueOrNumber, right: HOM.ValueOrNumber) {
  return new HOM.SubValue(left, right);
}

export function Mul(left: HOM.ValueOrNumber, right: HOM.ValueOrNumber) {
  return new HOM.MulValue(left, right);
}

export function Div(divide: HOM.ValueOrNumber, by: HOM.ValueOrNumber) {
  return new HOM.DivValue(divide, by);
}

export function Use(valueId: HOM.ValueId) {
  return new HOM.UseValue(valueId);
}

export type CondThen = { then: (v: HOM.ValueOrNumber) => CondElse };
export type CondElse = { else: (v: HOM.ValueOrNumber) => HOM.Value };

export function Cond(
  obs: HOM.ObservationOrBool,
  ifTrue: HOM.ValueOrNumber,
  ifFalse: HOM.ValueOrNumber
): HOM.Value;
export function Cond(obs: HOM.ObservationOrBool): CondThen;

export function Cond(
  obs: HOM.ObservationOrBool,
  ...ts: HOM.ValueOrNumber[]
): HOM.Value | CondThen {
  if (ts.length === 2) {
    return new HOM.CondValue(obs, ts[0], ts[1]);
  } else {
    return {
      then: (ifV: HOM.ValueOrNumber) => {
        return {
          else: (elseV: HOM.ValueOrNumber) => {
            return new HOM.CondValue(obs, ifV, elseV);
          },
        };
      },
    };
  }
}

export const TimeIntervalStart = new HOM.TimeIntervalStartValue();

export const TimeIntervalEnd = new HOM.TimeIntervalEndValue();

export function Max(a: HOM.ValueOrNumber, b: HOM.ValueOrNumber): HOM.Value {
  return Cond(HOM.numberToConstant(a).greaterThan(b), a, b);
}
export function Min(a: HOM.ValueOrNumber, b: HOM.ValueOrNumber): HOM.Value {
  return Cond(HOM.numberToConstant(a).lowerThan(b), a, b);
}

export function And(left: HOM.ObservationOrBool, right: HOM.ObservationOrBool) {
  return new HOM.AndObs(left, right);
}

export function Or(left: HOM.ObservationOrBool, right: HOM.ObservationOrBool) {
  return new HOM.OrObs(left, right);
}

export function Not(val: HOM.ObservationOrBool) {
  return new HOM.NotObs(val);
}

export function Eq(left: HOM.ValueOrNumber, right: HOM.ValueOrNumber) {
  return new HOM.ValueEq(left, right);
}

// TODO: Should we deprecate this smart constructor?
export function ValueGE(left: HOM.ValueOrNumber, right: HOM.ValueOrNumber) {
  return new HOM.ValueGEObs(left, right);
}

// TODO: Should we deprecate this smart constructor?
export function ValueGT(left: HOM.ValueOrNumber, right: HOM.ValueOrNumber) {
  return new HOM.ValueGTObs(left, right);
}

// TODO: Should we deprecate this smart constructor?
export function ValueLT(left: HOM.ValueOrNumber, right: HOM.ValueOrNumber) {
  return new HOM.ValueLTObs(left, right);
}

// TODO: Should we deprecate this smart constructor?
export function ValueLE(left: HOM.ValueOrNumber, right: HOM.ValueOrNumber) {
  return new HOM.ValueLEObs(left, right);
}

export function Notify(observation: HOM.ObservationOrBool) {
  return new HOM.NotifyAction(observation);
}

export function waitFor(action: HOM.Action) {
  return {
    then: (cont: HOM.Contract) => {
      return new HOM.When([action.then(cont)]);
    },
    after: (deadline: Date, deadlineCont: HOM.Contract) => ({
      then: (cont: HOM.Contract) => {
        return new HOM.When([action.then(cont)]).after(deadline, deadlineCont);
      },
    }),
  };
}

export function waitUntil(deadline: Date) {
  return {
    then: (cont: HOM.Contract) => new HOM.When([]).after(deadline, cont),
  };
}

export const Close = new HOM.Close();
export const Pay = (
  from: HOM.Party,
  to: HOM.Payee,
  token: HOM.Token,
  value: HOM.ValueOrNumber,
  cont: HOM.Contract
) => new HOM.Pay(from, to, token, value, cont);
// TODO: Maybe add overrides for IfElse
export function If(obs: HOM.ObservationOrBool): {
  then: (c: HOM.Contract) => { else: (c: HOM.Contract) => HOM.Contract };
};
export function If(
  obs: HOM.ObservationOrBool,
  ifTrue: HOM.Contract,
  ifFalse: HOM.Contract
): HOM.Contract;
export function If(obs: HOM.ObservationOrBool, ...args: any[]): any {
  if (args.length == 0) {
    return {
      then: (ifTrue: HOM.Contract) => ({
        else: (ifFalse: HOM.Contract) => new HOM.If(obs, ifTrue, ifFalse),
      }),
    };
  } else {
    return new HOM.If(obs, args[0], args[1]);
  }
}

export const When = (cases: HOM.Case[]) => new HOM.When(cases);
export function Deposit(
  intoAccount: HOM.Party,
  from: HOM.Party,
  token: HOM.Token,
  value: HOM.ValueOrNumber
) {
  return new HOM.DepositAction(intoAccount, from, token, value);
}

export function Chain(...chain: HOM.ThenableContract[]): HOM.ThenableContract {
  return {
    then: (cont: HOM.Contract) => HOM.Do(...chain, cont),
  };
}

export function All(actions: HOM.Action[], cont: HOM.Contract): HOM.Case[] {
  if (actions.length == 0) {
    return [];
  } else if (actions.length == 1) {
    return [actions[0].then(new HOM.RefContract(cont))];
  } else {
    return actions.flatMap((action, index) => {
      const c = When(
        All(actions.slice(0, index).concat(actions.slice(index + 1)), cont)
      );
      c.defaultContingency = cont.defaultContingency;
      return action.then(new HOM.RefContract(c));
    });
  }
}

export function Seq(actions: HOM.Action[], cont: HOM.Contract): HOM.Case[] {
  if (actions.length == 0) {
    return [];
  } else if (actions.length == 1) {
    return [actions[0].then(new HOM.RefContract(cont))];
  } else {
    const c = When(Seq(actions.slice(1), cont));
    c.defaultContingency = cont.defaultContingency;
    return [actions[0].then(new HOM.RefContract(c))];
  }
}

export function Any(actions: HOM.Action[], cont: HOM.Contract): HOM.Case[] {
  return actions.map((a) => a.then(cont));
}

type ContingencySetter<T> = {
  after: (timeout: Date, timeoutContract: HOM.Contract) => T;
};

export function SetContingency(
  scope: HOM.Contract
): ContingencySetter<HOM.Contract>;
export function SetContingency(
  scope: HOM.ThenableContract
): ContingencySetter<HOM.ThenableContract>;
export function SetContingency(scope: HOM.Contract | HOM.ThenableContract) {
  return {
    after: (timeout: Date, timeoutContract: HOM.Contract) => {
      if ("then" in scope) {
        return {
          then: (cont: HOM.Contract) => {
            const finalCont = scope.then(cont);
            finalCont.defaultContingency = [timeout, timeoutContract];
            return finalCont;
          },
        };
      } else {
        scope.defaultContingency = [timeout, timeoutContract];
        return scope;
      }
    },
  };
}

export const lovelace = token("", "");

export function token(currencySymbol: string, tokenName: string): HOM.Token {
  return new HOM.Token(currencySymbol, tokenName);
}

type LetInBody = (ref: HOM.Value) => HOM.Contract;
// TODO: Add overrides
export function Let(id: string, value: HOM.ValueOrNumber) {
  return {
    then: (cont: HOM.Contract) => {
      return new HOM.Let(id, HOM.numberToConstant(value), cont);
    },
    in: (body: LetInBody) => {
      return new HOM.Let(
        id,
        HOM.numberToConstant(value),
        body(new HOM.UseValue(id))
      );
    },
  };
}
