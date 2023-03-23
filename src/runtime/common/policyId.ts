import * as t from "io-ts";
import { iso, Newtype } from "newtype-ts";
import { fromNewtype } from "io-ts-types";

export type PolicyId = Newtype<{ readonly PolicyId: unique symbol }, string> 
export const PolicyId = fromNewtype<PolicyId>(t.string)
export const unPolicyId =  iso<PolicyId>().unwrap
export const policyId   =  iso<PolicyId>().wrap
