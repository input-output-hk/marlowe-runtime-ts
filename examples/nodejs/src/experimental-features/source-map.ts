import * as M from "fp-ts/lib/Map.js";

import { ContractBundleMap, bundleMapToList, isAnnotated, stripAnnotations } from "@marlowe.io/marlowe-object";
import { ContractInstanceAPI, CreateContractRequestBase, RuntimeLifecycle } from "@marlowe.io/runtime-lifecycle/api";

import { ContractClosure, getContractClosure } from "./contract-closure.js";
import * as Core from "@marlowe.io/language-core-v1";
import * as CoreG from "@marlowe.io/language-core-v1/guards";
import * as Obj from "@marlowe.io/marlowe-object";
import * as ObjG from "@marlowe.io/marlowe-object/guards";

import { SingleInputTx, TransactionOutput, playSingleInputTxTrace } from "@marlowe.io/language-core-v1/semantics";
import { RestClient } from "@marlowe.io/runtime-rest-client";
import { ContractId, TxId } from "@marlowe.io/runtime-core";
import { deepEqual } from "@marlowe.io/adapter/deep-equal";

function annotateInputFromClosure(contractClosure: ContractClosure) {
  return function (input: Core.Input): Core.Input {
    if (input === "input_notify") return "input_notify";
    if ("merkleized_continuation" in input) {
      const annotatedContinuation = contractClosure.contracts.get(input.continuation_hash);
      if (typeof annotatedContinuation === "undefined")
        throw new Error(`Cant find continuation for ${input.continuation_hash}`);
      return { ...input, merkleized_continuation: annotatedContinuation };
    } else {
      return input;
    }
  };
}

function annotateHistoryFromClosure(contractClosure: ContractClosure) {
  return function (history: SingleInputTx[]): SingleInputTx[] {
    return history.map((tx) => {
      if (typeof tx.input === "undefined") {
        return tx;
      } else {
        return {
          ...tx,
          input: annotateInputFromClosure(contractClosure)(tx.input),
        };
      }
    });
  };
}

async function annotatedClosure<T>(
  restClient: RestClient,
  sourceObjectMap: ContractBundleMap<T>
): Promise<ContractClosure> {
  const { contractSourceId, intermediateIds } = await restClient.createContractSources({
    bundle: bundleMapToList(sourceObjectMap),
  });

  const closure = await getContractClosure({ restClient })(contractSourceId);

  // The intermediateIds is an object whose keys belong to the source code and value is the merkle hash.
  // We need to reverse this object in order to annotate the closure using the source annotations.
  // It is possible for two different source entries to have the same hash and different annotations.
  // In that case the last annotation will prevail.
  const sourceMap = Object.fromEntries(Object.entries(intermediateIds).map(([source, hash]) => [hash, source]));

  function getSourceContract(ref: Obj.Label) {
    const sourceContractObject = sourceObjectMap.objects[ref];
    if (typeof sourceContractObject === "undefined") throw new Error(`Cant find source for ${ref}`);

    return sourceContractObject.value as Obj.Contract<unknown>;
  }

  function copyAnnotation<T extends object>(source: object, dst: T): T {
    if (isAnnotated(source)) {
      return { annotation: source.annotation, ...dst };
    }
    return dst;
  }

  function annotateContract(source: Obj.Contract<unknown>, dst: Core.Contract): Core.Contract {
    let srcContract = source;
    if (ObjG.Reference.is(source)) {
      srcContract = getSourceContract(source.ref);
    }

    if (CoreG.Close.is(dst) && ObjG.Close.is(srcContract)) {
      return srcContract as Core.Close;
    }

    if (CoreG.Pay.is(dst) && ObjG.Pay.is(srcContract)) {
      return copyAnnotation(srcContract, {
        ...dst,
        then: annotateContract(srcContract.then, dst.then),
      });
    }

    if (CoreG.If.is(dst) && ObjG.If.is(srcContract)) {
      return copyAnnotation(srcContract, {
        ...dst,
        then: annotateContract(srcContract.then, dst.then),
        else: annotateContract(srcContract.else, dst.else),
      });
    }

    if (CoreG.Let.is(dst) && ObjG.Let.is(srcContract)) {
      return copyAnnotation(srcContract, {
        ...dst,
        then: annotateContract(srcContract.then, dst.then),
      });
    }

    if (CoreG.Assert.is(dst) && ObjG.Assert.is(srcContract)) {
      return copyAnnotation(srcContract, {
        ...dst,
        then: annotateContract(srcContract.then, dst.then),
      });
    }

    if (CoreG.When.is(dst) && ObjG.When.is(srcContract)) {
      const srcWhen = srcContract;
      return copyAnnotation(srcWhen, {
        ...dst,
        timeout_continuation: annotateContract(srcWhen.timeout_continuation, dst.timeout_continuation),
        when: dst.when.map((dstCase, index) => {
          const srcCase = srcWhen.when[index];
          if ("merkleized_then" in srcCase) {
            throw new Error(`Merkleized not supported in source.`);
          }

          if ("then" in srcCase && "then" in dstCase) {
            return {
              ...dstCase,
              then: annotateContract(srcCase.then, dstCase.then),
            };
          } else {
            return dstCase;
          }
        }),
      });
    }

    throw new Error(`Cant annotate source contract.`);
  }

  function annotateEntry(key: string, contract: Core.Contract): Core.Contract {
    const sourceContract = getSourceContract(sourceMap[key]);
    return annotateContract(sourceContract, contract);
  }

  return {
    main: closure.main,
    contracts: M.mapWithIndex(annotateEntry)(closure.contracts),
  };
}

export interface SourceMap<T> {
  source: ContractBundleMap<T>;
  closure: ContractClosure;
  annotateHistory(history: SingleInputTx[]): SingleInputTx[];
  playHistory(history: SingleInputTx[]): TransactionOutput;
  createContract(options: CreateContractRequestBase): Promise<ContractInstanceAPI>;
  contractInstanceOf(contractId: ContractId): Promise<boolean>;
}

export async function mkSourceMap<T>(
  lifecycle: RuntimeLifecycle,
  sourceObjectMap: ContractBundleMap<T>
): Promise<SourceMap<T>> {
  const closure = await annotatedClosure(lifecycle.restClient, sourceObjectMap);
  return {
    source: sourceObjectMap,
    closure,
    annotateHistory: (history: SingleInputTx[]) => {
      return annotateHistoryFromClosure(closure)(history);
    },
    playHistory: (history: SingleInputTx[]) => {
      const annotatedHistory = annotateHistoryFromClosure(closure)(history);
      const main = closure.contracts.get(closure.main);
      if (typeof main === "undefined") throw new Error(`Cant find main.`);
      return playSingleInputTxTrace(0n, main, annotatedHistory);
    },
    createContract: (options: CreateContractRequestBase) => {
      const contract = stripAnnotations(closure.contracts.get(closure.main)!);
      return lifecycle.newContractAPI.create({
        ...options,
        contract,
      });
    },
    contractInstanceOf: async (contractId: ContractId) => {
      const contractDetails = await lifecycle.restClient.getContractById({
        contractId,
      });

      const initialContract = await lifecycle.restClient.getContractSourceById({
        contractSourceId: closure.main,
      });

      return deepEqual(initialContract, contractDetails.initialContract);
    },
  };
}
