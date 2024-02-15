/**
 * This module allows to bundle different {@link ObjectType | ObjectTypes} in a JavaScript object.
 * To create a valid bundle, all references must be defined and there should not be any cyclic dependencies.
 *
 * You can use {@link index.bundleMapToList} to convert to {@link bundle-list.ContractBundleList} while checking for
 * the integrity of the bundle.
 * ```
 * import { ContractBundleMap, close, lovelace } from "@marlowe.io/marlowe-object"
 *
 * type MyContractAnnotation = "AnnotationA" | "AnnotationB" | "AnnotationC";
 *
 * const example: ContractBundleMap<MyContractAnnotation> = {
 *   main: "mainContract",
 *   objects: {
 *     partyA: {
 *       type: "party",
 *       value: { role_token: "partyA" },
 *     },
 *     partyADeposits: {
 *       type: "action",
 *       value: {
 *         party: { ref: "partyA" },
 *         deposits: 1000000n,
 *         of_token: lovelace,
 *         into_account: { ref: "partyA" },
 *       },
 *     },
 *     mainContract: {
 *       type: "contract",
 *       value: {
 *         annotation: "AnnotationA",
 *         when: [{ case: { ref: "partyADeposits" }, then: close("AnnotationB") }],
 *         timeout: 10000n,
 *         timeout_continuation: close("AnnotationC"),
 *       },
 *     },
 *   },
 * };
 * ```
 * @packageDocumentation
 */
export {
  ObjectParty,
  ObjectValue,
  ObjectObservation,
  ObjectToken,
  ObjectContract,
  ObjectAction,
  ObjectType,
  BundleMap,
  ContractBundleMap,
  mergeBundleMaps,
} from "./bundle-map.js";
