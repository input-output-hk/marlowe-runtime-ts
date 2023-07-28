
import { pipe } from 'fp-ts/function'
import * as O from 'fp-ts/lib/Option';
import * as TE from 'fp-ts/TaskEither'
import { close } from '../../../src/language/core/v1/semantics/contract/close'
import { mkRuntimeRestAPI } from '../../../src/runtime/restAPI';
import { initialise } from '../../../src/runtime/write/command';
import { initialiseBankAndverifyProvisionning } from '../provisionning'
import { getBankPrivateKey, getBlockfrostContext, getMarloweRuntimeUrl } from '../context';
import { RolesConfig } from '../../../src/runtime/contract/role';
import { unAddressBech32 } from '../../../src/runtime/common/address';


describe('contracts endpoints', () => {

  const runtimeRestAPI = mkRuntimeRestAPI(getMarloweRuntimeUrl())

  it(' can build a Tx for Initialising a Marlowe Contract' +
    '(can POST: /contracts/ )', async () => {
      await
        pipe(initialiseBankAndverifyProvisionning
          (runtimeRestAPI)
          (getBlockfrostContext())
          (getBankPrivateKey())
          , TE.bind('postContractResponse', ({ bank }) =>
            runtimeRestAPI.contracts.post({
              contract: close
              , version: 'v1'
              , metadata: {}
              , tags: {}
              , minUTxODeposit: 2_000_000
            }
              , {
                changeAddress: bank.address
                , usedAddresses: O.none
                , collateralUTxOs: O.none
              }))
          , TE.map(({ postContractResponse }) => postContractResponse)
          , TE.match(
            (e) => { console.dir(e, { depth: null }); expect(e).not.toBeDefined() },
            () => { }))()

    }, 100_000),
    it('can Initialise a Marlowe Contract ' +
      '(can POST: /contracts/ => build the Tx server side' +
      ' and PUT : /contracts/{contractid} => Append the Contract Tx to the Cardano ledger' +
      ' and GET /contracts/{contractid} => provide details about the contract initialised)', async () => {
        await
          pipe(initialiseBankAndverifyProvisionning
            (runtimeRestAPI)
            (getBlockfrostContext())
            (getBankPrivateKey())
            , TE.bindW('contracId', ({ bank }) => 
                initialise (runtimeRestAPI)(bank)
                  ({contract: {"from_account":{"address":unAddressBech32(bank.address)},"pay":10000000n,"then":"close","to":{"party":{"role_token":"WithdrawalTest1"}},"token":{"currency_symbol":"","token_name":""}}
                   ,roles : "8bb3b343d8e404472337966a722150048c768d0a92a9813596c5338d"}))
            , TE.match(
              (e) => {
                console.dir(e, { depth: null });
                expect(e).not.toBeDefined()
              },
              (contract) => {console.log("contractID created" ,contract) }))()

      }, 100_000),
    it('can navigate throught Initialised Marlowe Contracts pages' +
      '(GET:  /contracts/)', async () => {
        await
          pipe(initialiseBankAndverifyProvisionning
            (runtimeRestAPI)
            (getBlockfrostContext())
            (getBankPrivateKey())
            , TE.bindW('firstPage', () => runtimeRestAPI.contracts.getHeadersByRange(O.none)(['swap.L1.by.marlowe.team', "initialised"]))
            , TE.match(
              (e) => { console.dir(e, { depth: null }); expect(e).not.toBeDefined() },
              (a) => { console.log("result",a.firstPage.headers.length)}))()


      }, 100_000)
})

