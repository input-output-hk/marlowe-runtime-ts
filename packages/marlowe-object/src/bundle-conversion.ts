import { Action, matchAction } from "./actions.js";
import { BundleList, ContractBundleList } from "./bundle-list/bundle-list.js";
import * as BundleL from "./bundle-list/bundle-list.js";
import * as BundleM from "./bundle-map/bundle-map.js";
import { ContractBundleMap } from "./bundle-map/bundle-map.js";
import { Contract, matchContract } from "./contract.js";
import { Party, matchParty } from "./participants.js";
import { Payee, matchPayee } from "./payee.js";
import { Label } from "./reference.js";
import { Token } from "./token.js";
import { Observation, Value, matchObservation, matchValue } from "./value-and-observation.js";

export class CircularDependencyError extends Error {
  constructor(label: Label) {
    super(`Circular dependency detected ${label}`);
  }
}

/**
 * This error happens when a label is referenced but is missing from the bundle.
 */
export class MissingLabelError extends Error {
  constructor(label: Label) {
    super(`Missing label ${label}`);
  }
}

export class LabelReferencedBeforeDefinedError extends Error {
  constructor(label: Label) {
    super(
      `Label ${label} referenced before defined. This can mean that there is a circular dependency or just that the order is wrong.`
    );
  }
}

export class LabelRedefinedError extends Error {
  constructor(label: Label) {
    super(`Label ${label} was already defined`);
  }
}

export type ObjectTypes = "action" | "contract" | "observation" | "party" | "token" | "value";

export class ObjectTypeMismatchError extends Error {
  constructor(label: Label, expected: ObjectTypes, got: ObjectTypes) {
    super(`Expected ${label} to be a ${expected} but got ${got} instead.`);
  }
}
/**
 * Converts a {@link ContractBundleMap} to a {@link ContractBundleList} while checking
 * the integrity of the bundle.
 *
 * @typeParam A - An optional {@link index.Annotated | annotation} of the contract nodes.
 * @throws {@link CircularDependencyError} if a circular dependency is detected.
 * @throws {@link MissingLabelError} if a label referenced either in the `main` contract or one of the entries but is missing from the bundle.
 * @throws {@link ObjectTypeMismatchError} if a bundle entry does not have the expected type.
 * @category Bundle
 */
export function bundleMapToList<A>(contractBundleMap: ContractBundleMap<A>): ContractBundleList<A> {
  const goValue = (parents: Label[]) =>
    matchValue({
      availableMoney: (v) => {
        goToken(v.amount_of_token);
        goParty(v.in_account);
      },
      negValue: (v) => {
        goValue(parents)(v.negate);
      },
      addValue: (v) => {
        goValue(parents)(v.add);
        goValue(parents)(v.and);
      },
      subValue: (v) => {
        goValue(parents)(v.value);
        goValue(parents)(v.minus);
      },
      mulValue: (v) => {
        goValue(parents)(v.multiply);
        goValue(parents)(v.times);
      },
      divValue: (v) => {
        goValue(parents)(v.divide);
        goValue(parents)(v.by);
      },
      choiceValue: (v) => {
        goParty(v.value_of_choice.choice_owner);
      },
      cond: (v) => {
        goObservation(parents)(v.if);
        goValue(parents)(v.then);
        goValue(parents)(v.else);
      },
      reference: (v) => goRef(v.ref, "value", parents),
    });
  function goToken(token: Token) {
    if ("ref" in token) {
      goRef(token.ref, "token", []);
    }
  }
  const goParty = matchParty({
    reference: (p) => goRef(p.ref, "party", []),
  });

  const goObservation = (parents: Label[]) =>
    matchObservation({
      andObs: (o) => {
        goObservation(parents)(o.and);
        goObservation(parents)(o.both);
      },
      orObs: (o) => {
        goObservation(parents)(o.either);
        goObservation(parents)(o.or);
      },
      notObs: (o) => {
        goObservation(parents)(o.not);
      },
      choseSomething: (o) => {
        goParty(o.chose_something_for.choice_owner);
      },
      valueEQ: (o) => {
        goValue(parents)(o.value);
        goValue(parents)(o.equal_to);
      },
      valueGT: (o) => {
        goValue(parents)(o.value);
        goValue(parents)(o.gt);
      },
      valueGE: (o) => {
        goValue(parents)(o.value);
        goValue(parents)(o.ge_than);
      },
      valueLT: (o) => {
        goValue(parents)(o.value);
        goValue(parents)(o.lt);
      },
      valueLE: (o) => {
        goValue(parents)(o.value);
        goValue(parents)(o.le_than);
      },
      reference: (o) => goRef(o.ref, "observation", parents),
    });

  const goAction = (parents: Label[]) =>
    matchAction({
      deposit: (a) => {
        goParty(a.party);
        goValue(parents)(a.deposits);
        goToken(a.of_token);
        goParty(a.into_account);
      },
      choice: (a) => {
        goParty(a.for_choice.choice_owner);
      },
      notify: (a) => {
        goObservation(parents)(a.notify_if);
      },
      reference: (a) => goRef(a.ref, "action", parents),
    });

  const goPayee = matchPayee({
    party: goParty,
    account: goParty,
  });

  const goContract = (parents: Label[]) =>
    matchContract({
      pay: (c) => {
        goValue(parents)(c.pay);
        goToken(c.token);
        goParty(c.from_account);
        goPayee(c.to);
        goContract(parents)(c.then);
      },
      if: (c) => {
        goObservation(parents)(c.if);
        goContract(parents)(c.then);
        goContract(parents)(c.else);
      },
      when: (c) => {
        c.when.forEach((aCase) => {
          goAction(parents)(aCase.case);
          if ("then" in aCase) {
            goContract(parents)(aCase.then);
          } else {
            goRef(aCase.merkleized_then, "contract", parents);
          }
        });
        goContract(parents)(c.timeout_continuation);
      },
      let: (c) => {
        goValue(parents)(c.be);
        goContract(parents)(c.then);
      },
      assert: (c) => {
        goObservation(parents)(c.assert);
        goContract(parents)(c.then);
      },
      reference: (c) => goRef(c.ref, "contract", parents),
    });

  // Global variables between the inner recursions
  const bundle: BundleList<A> = [];
  const visited = new Set<Label>();

  function goRef(label: Label, type: ObjectTypes, parents: Label[]) {
    const obj = contractBundleMap.objects[label];
    if (!obj) {
      throw new MissingLabelError(label);
    }
    if (obj.type !== type) {
      throw new ObjectTypeMismatchError(label, type, obj.type);
    }

    // We don't process the same element twice.
    if (visited.has(label)) {
      return;
    }
    if (parents.includes(label)) {
      throw new CircularDependencyError(label);
    }
    switch (obj.type) {
      case "contract":
        goContract([...parents, label])(obj.value);
        break;
      case "value":
        goValue([...parents, label])(obj.value);
        break;
      case "token":
        goToken(obj.value);
        break;
      case "party":
        goParty(obj.value);
        break;
      case "observation":
        goObservation([...parents, label])(obj.value);
        break;
      case "action":
        goAction([...parents, label])(obj.value);
        break;
    }
    bundle.push({ label, type, value: obj.value } as BundleL.ObjectType<A>);
    visited.add(label);
  }
  goRef(contractBundleMap.main, "contract", []);
  return { main: contractBundleMap.main, bundle };
}

/**
 * Converts a {@link ContractBundleList} to a {@link ContractBundleMap} while checking
 * the integrity of the bundle.
 * @typeParam A - An optional {@link index.Annotated | annotation} of the contract nodes.
 * @throws {@link LabelReferencedBeforeDefinedError} If a reference is used before the object type definition. This can hint a cyclic dependency.
 * @throws {@link MissingLabelError} If a reference is not present in the bundle.
 * @throws {@link ObjectTypeMismatchError} if a bundle entry does not have the expected type.
 * @throws {@link LabelRedefinedError} if a bundle entry is defined more than once.
 * @category Bundle
 */
export function bundleListToMap<A>(contractBundleList: ContractBundleList<A>): ContractBundleMap<A> {
  const bundleMap = {} as BundleM.BundleMap<A>;

  function checkReference(label: Label, expectedType: ObjectTypes, tail: BundleList<A>) {
    const obj = bundleMap[label];
    if (typeof obj === "undefined") {
      if (tail.some((obj) => obj.label === label)) {
        throw new LabelReferencedBeforeDefinedError(label);
      }
      throw new MissingLabelError(label);
    } else {
      if (obj.type !== expectedType) {
        throw new ObjectTypeMismatchError(label, expectedType, obj.type);
      }
    }
  }
  function checkValue(value: Value, tail: BundleList<A>) {
    matchValue({
      availableMoney: (v) => {
        checkToken(v.amount_of_token, tail);
        checkParty(v.in_account, tail);
      },
      negValue: (v) => {
        checkValue(v.negate, tail);
      },
      addValue: (v) => {
        checkValue(v.add, tail);
        checkValue(v.and, tail);
      },
      subValue: (v) => {
        checkValue(v.value, tail);
        checkValue(v.minus, tail);
      },
      mulValue: (v) => {
        checkValue(v.multiply, tail);
        checkValue(v.times, tail);
      },
      divValue: (v) => {
        checkValue(v.divide, tail);
        checkValue(v.by, tail);
      },
      choiceValue: (v) => {
        checkParty(v.value_of_choice.choice_owner, tail);
      },
      cond: (v) => {
        checkObservation(v.if, tail);
        checkValue(v.then, tail);
        checkValue(v.else, tail);
      },
      reference: (v) => checkReference(v.ref, "value", tail),
    })(value);
  }
  function checkToken(token: Token, tail: BundleList<A>) {
    if ("ref" in token) {
      checkReference(token.ref, "token", tail);
    }
  }
  function checkParty(party: Party, tail: BundleList<A>) {
    matchParty({
      reference: (p) => checkReference(p.ref, "party", tail),
    })(party);
  }
  function checkPayee(payee: Payee, tail: BundleList<A>) {
    matchPayee({
      party: (p) => checkParty(p, tail),
      account: (p) => checkParty(p, tail),
    })(payee);
  }
  function checkObservation(observation: Observation, tail: BundleList<A>) {
    matchObservation({
      andObs: (o) => {
        checkObservation(o.and, tail);
        checkObservation(o.both, tail);
      },
      orObs: (o) => {
        checkObservation(o.either, tail);
        checkObservation(o.or, tail);
      },
      notObs: (o) => {
        checkObservation(o.not, tail);
      },
      choseSomething: (o) => {
        checkParty(o.chose_something_for.choice_owner, tail);
      },
      valueEQ: (o) => {
        checkValue(o.value, tail);
        checkValue(o.equal_to, tail);
      },
      valueGT: (o) => {
        checkValue(o.value, tail);
        checkValue(o.gt, tail);
      },
      valueGE: (o) => {
        checkValue(o.value, tail);
        checkValue(o.ge_than, tail);
      },
      valueLT: (o) => {
        checkValue(o.value, tail);
        checkValue(o.lt, tail);
      },
      valueLE: (o) => {
        checkValue(o.value, tail);
        checkValue(o.le_than, tail);
      },
      reference: (o) => checkReference(o.ref, "observation", tail),
    })(observation);
  }
  function checkAction(action: Action, tail: BundleList<A>) {
    matchAction({
      deposit: (a) => {
        checkParty(a.party, tail);
        checkValue(a.deposits, tail);
        checkToken(a.of_token, tail);
        checkParty(a.into_account, tail);
      },
      choice: (a) => {
        checkParty(a.for_choice.choice_owner, tail);
      },
      notify: (a) => {
        checkObservation(a.notify_if, tail);
      },
      reference: (a) => checkReference(a.ref, "action", tail),
    })(action);
  }
  function checkContract(contract: Contract<unknown>, tail: BundleList<A>) {
    matchContract({
      pay: (c) => {
        checkValue(c.pay, tail);
        checkToken(c.token, tail);
        checkParty(c.from_account, tail);
        checkPayee(c.to, tail);
        checkContract(c.then, tail);
      },
      if: (c) => {
        checkObservation(c.if, tail);
        checkContract(c.then, tail);
        checkContract(c.else, tail);
      },
      when: (c) => {
        c.when.forEach((aCase) => {
          checkAction(aCase.case, tail);
          if ("then" in aCase) {
            checkContract(aCase.then, tail);
          } else {
            checkReference(aCase.merkleized_then, "contract", tail);
          }
        });
        checkContract(c.timeout_continuation, tail);
      },
      let: (c) => {
        checkValue(c.be, tail);
        checkContract(c.then, tail);
      },
      assert: (c) => {
        checkObservation(c.assert, tail);
        checkContract(c.then, tail);
      },
      reference: (c) => checkReference(c.ref, "contract", tail),
    })(contract);
  }

  function goBundle(bundle: BundleList<A>) {
    if (bundle.length === 0) {
      return;
    }

    const head = bundle[0];
    const tail = bundle.slice(1);
    if (typeof bundleMap[head.label] !== "undefined") {
      throw new LabelRedefinedError(head.label);
    }

    switch (head.type) {
      case "contract":
        checkContract(head.value, tail);
        break;
      case "value":
        checkValue(head.value, tail);
        break;
      case "token":
        checkToken(head.value, tail);
        break;
      case "party":
        checkParty(head.value, tail);
        break;
      case "observation":
        checkObservation(head.value, tail);
        break;
      case "action":
        checkAction(head.value, tail);
        break;
    }

    bundleMap[head.label] = {
      type: head.type,
      value: head.value,
    } as BundleM.ObjectType<A>;

    goBundle(tail);
  }
  goBundle(contractBundleList.bundle);
  checkReference(contractBundleList.main, "contract", []);
  return {
    main: contractBundleList.main,
    objects: bundleMap,
  };
}
