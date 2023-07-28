import * as t from "io-ts"
import { PolicyId } from "./policyId"
import * as T from "./token"



export const toString : (token : TokenValue) => string = (tokenValue) => `${tokenValue.amount} - ${T.toString(tokenValue.token)}`


export type TokenValue = t.TypeOf<typeof TokenValue>
export const TokenValue = t.type({amount:t.bigint,token:T.Token})
export const tokenValue : (amount : bigint) => (token : T.Token) => TokenValue 
    = (amount) => (token) => ({amount:amount,token:token})



export const lovelaceValue : (lovelaces : bigint)  => TokenValue 
    = (lovelaces)  => ({amount:lovelaces,token:T.adaToken})


export const adaValue : (adaAmount : bigint)  => TokenValue 
    = (adaAmount)  => ({amount:adaAmount*1_000_000n,token:T.adaToken})
