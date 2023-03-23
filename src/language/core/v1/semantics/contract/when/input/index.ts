import * as t from "io-ts";
import { Contract } from "../..";

import { InputChoice } from "./choice";
import { InputDeposit } from "./deposit";
import { InputNotify } from "./notify";

export type  BuiltinByteString = t.TypeOf<typeof BuiltinByteString>
export const BuiltinByteString = t.string

export type InputContent = t.TypeOf<typeof InputContent>
export const InputContent 
  =  t.union ([ InputDeposit
              , InputChoice
              , InputNotify])

export type NormalInput = t.TypeOf<typeof NormalInput>
export const NormalInput = InputContent
 
export type MerkleizedInput = t.TypeOf<typeof MerkleizedInput>
export const MerkleizedInput 
  = t.intersection(
      [ InputContent
      ,t.partial({ continuation_hash : BuiltinByteString
                 , merkleized_continuation:Contract })
      ])


export type Input = t.TypeOf<typeof Input>
export const Input = t.union([NormalInput,MerkleizedInput])