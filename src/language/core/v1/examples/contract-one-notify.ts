/* eslint-disable sort-keys-fix/sort-keys-fix */

import { Contract } from "../semantics/contract";
import { close } from "../semantics/contract/close";
import { Timeout } from "../semantics/contract/when";


/**
 * Marlowe Example : A contract with One Step (one true notify)
 */

export const oneNotifyTrue : (notifyTimeout:Timeout) => Contract 
  = (notifyTimeout) => 
      ({ when :[{ case :{ notify_if: true }
                        , then : close}]
                , timeout : notifyTimeout
                , timeout_continuation : close})
        

