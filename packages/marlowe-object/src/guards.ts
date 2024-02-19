/**
  * This module offers {@link !io-ts-usage | dynamic type guards} for the for the JSON schema of marlowe-objects.
  ```
  import * as G from "@marlowe/marlowe-objects/guards"

  const jsonObject = JSON.parse(fileContents)

  if (G.ContractBundleMap.is(jsonObject)) {
    // console.log("Object is a bundle")
    // console.log("entry contract is ", jsonObject.main)
    //...
  } else {
    // console.error(...)
  }
  ```
  @packageDocumentation
 */

import * as BL from "./bundle-list/bundle-list.js";
import * as BM from "./bundle-map/bundle-map.js";

export {
  ActionGuard as Action,
  DepositGuard as Deposit,
  NotifyGuard as Notify,
  ChoiceGuard as Choice,
} from "./actions.js";

export {
  Address,
  Role,
  ChoiceName,
  Bound,
  Token as CoreToken,
  TokenName,
  Constant,
  TimeIntervalStart,
  TimeIntervalEnd,
  UseValue,
  ValueId,
} from "@marlowe.io/language-core-v1/guards";

export { ChoiceIdGuard as ChoiceId } from "./choices.js";

export {
  ReferenceGuard as Reference,
  LabelGuard as Label,
} from "./reference.js";
export { PartyGuard as Party } from "./participants.js";
export {
  PayeeAccountGuard as PayeeAccount,
  PayeePartyGuard as PayeeParty,
  AccountIdGuard as AccountId,
} from "./payee.js";
export { TokenGuard as Token } from "./token.js";

export {
  ValueGuard as Value,
  AvailableMoneyGuard as AvailableMoney,
  NegValueGuard as NegValue,
  AddValueGuard as AddValue,
  SubValueGuard as SubValue,
  MulValueGuard as MulValue,
  DivValueGuard as DivValue,
  ChoiceValueGuard as ChoiceValue,
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
  CloseGuard as Close,
  ContractGuard as Contract,
  PayGuard as Pay,
  AssertGuard as Assert,
  IfGuard as If,
  LetGuard as Let,
  WhenGuard as When,
  NormalCaseGuard as NormalCase,
  MerkleizedCaseGuard as MerkleizedCase,
} from "./contract.js";

export {
  BundleListGuard as BundleList,
  ContractBundleListGuard as ContractBundleList,
} from "./bundle-list/bundle-list.js";

export const BundleListObject = {
  Party: BL.ObjectPartyGuard,
  Value: BL.ObjectValueGuard,
  Observation: BL.ObjectObservationGuard,
  Token: BL.ObjectTokenGuard,
  Contract: BL.ObjectContractGuard,
  Action: BL.ObjectActionGuard,
};

export {
  BundleMapGuard as BundleMap,
  ContractBundleMapGuard as ContractBundleMap,
} from "./bundle-map/bundle-map.js";

export const BundleMapObject = {
  Party: BM.ObjectPartyGuard,
  Value: BM.ObjectValueGuard,
  Observation: BM.ObjectObservationGuard,
  Token: BM.ObjectTokenGuard,
  Contract: BM.ObjectContractGuard,
  Action: BM.ObjectActionGuard,
};

export { AnnotatedGuard as Annotated } from "./annotations.js";
