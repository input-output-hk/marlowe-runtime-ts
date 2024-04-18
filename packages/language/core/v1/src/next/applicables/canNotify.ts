import * as t from "io-ts/lib/index.js";
import { IsMerkleizedContinuation } from "../common/IsMerkleizedContinuation.js";
import { CaseIndex } from "../common/caseIndex.js";
import { INotify } from "../../inputs.js";

/**
 * @deprecated Deprecated in favour of {@link @marlowe.io/runtime-lifecycle!api.ApplicableActionsAPI}
 */
export type CanNotify = t.TypeOf<typeof CanNotify>;
/**
 * @deprecated Deprecated in favour of {@link @marlowe.io/runtime-lifecycle!api.ApplicableActionsAPI}
 */
export const CanNotify = t.type({
  case_index: CaseIndex,
  is_merkleized_continuation: IsMerkleizedContinuation,
});
/**
 * @deprecated Deprecated in favour of {@link @marlowe.io/runtime-lifecycle!api.ApplicableActionsAPI}
 */
export const toInput: (canNotify: CanNotify) => INotify = (canNotify) => "input_notify";
