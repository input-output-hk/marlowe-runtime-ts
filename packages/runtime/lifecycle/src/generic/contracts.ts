import * as TE from "fp-ts/lib/TaskEither.js";
import { pipe } from "fp-ts/lib/function.js";
import { Option } from "fp-ts/lib/Option.js";
import { Environment, Party } from "@marlowe.io/language-core-v1";
import { tryCatchDefault, unsafeTaskEither } from "@marlowe.io/adapter/fp-ts";
import {
  ApplyInputsRequest,
  ContractsAPI,
  ContractsDI,
  CreateContractRequest,
  CreateContractRequestBase,
} from "../api.js";

import { getAddressesAndCollaterals, WalletAPI } from "@marlowe.io/wallet/api";
import {
  PolicyId,
  ContractId,
  contractIdToTxId,
  TxId,
  AddressesAndCollaterals,
  HexTransactionWitnessSet,
  transactionWitnessSetTextEnvelope,
  BlockHeader,
} from "@marlowe.io/runtime-core";

import { FPTSRestAPI, RestClient, ItemRange } from "@marlowe.io/runtime-rest-client";
import { DecodingError } from "@marlowe.io/adapter/codec";

import { Next, noNext } from "@marlowe.io/language-core-v1/next";
import {
  BuildCreateContractTxRequest,
  BuildCreateContractTxRequestOptions,
  TransactionTextEnvelope,
} from "@marlowe.io/runtime-rest-client/contract";
import { SingleInputTx } from "@marlowe.io/language-core-v1/transaction.js";
import { iso8601ToPosixTime } from "@marlowe.io/adapter/time";

export function mkContractLifecycle(
  wallet: WalletAPI,
  deprecatedRestAPI: FPTSRestAPI,
  restClient: RestClient
): ContractsAPI {
  const di = { wallet, deprecatedRestAPI, restClient };
  return {
    createContract: createContract(di),
    applyInputs: applyInputsTx(di),
    getApplicableInputs: getApplicableInputs(di),
    getContractIds: getContractIds(di),
    getInputHistory: getInputHistory(di),
  };
}
const getInputHistory =
  ({ restClient }: ContractsDI) =>
  async (contractId: ContractId): Promise<SingleInputTx[]> => {
    const transactionHeaders = await restClient.getTransactionsForContract({
      contractId,
    });
    const transactions = await Promise.all(
      transactionHeaders.transactions.map((txHeader) =>
        restClient.getContractTransactionById({
          contractId,
          txId: txHeader.transactionId,
        })
      )
    );
    const sortOptionalBlock = (a: Option<BlockHeader>, b: Option<BlockHeader>) => {
      if (a._tag === "None" || b._tag === "None") {
        // TODO: to avoid this error we should provide a higer level function that gets the transactions as the different
        //       status and with the appropiate values for each state.
        throw new Error("A confirmed transaction should have a valid block");
      } else {
        if (a.value.blockNo < b.value.blockNo) {
          return -1;
        } else if (a.value.blockNo > b.value.blockNo) {
          return 1;
        } else {
          return 0;
        }
      }
    };
    return transactions
      .filter((tx) => tx.status === "confirmed")
      .sort((a, b) => sortOptionalBlock(a.block, b.block))
      .map((tx) => {
        const interval = {
          from: iso8601ToPosixTime(tx.invalidBefore),
          // FIXME: The runtime method getContractTransactionById responds
          //        a cardano timeinterval (which is closed on the lower bound and
          //        open in the upper bound), and a Marlowe time interval is closed
          //        in both parts. Here I substract 1 millisecond from the open bound
          //        to get a "safe" closed bound. But the runtime should instead respond
          //        with the same interval as computed here:
          //        https://github.com/input-output-hk/marlowe-cardano/blob/9ae464a2be332a004cc4d5284fb1ccaf607fa6c7/marlowe-runtime/tx/Language/Marlowe/Runtime/Transaction/BuildConstraints.hs#L463-L479
          to: iso8601ToPosixTime(tx.invalidHereafter) - 1n,
        };
        if (tx.inputs.length === 0) {
          return [{ interval }];
        } else {
          return tx.inputs.map((input) => ({ input, interval }));
        }
      })
      .flat();
  };

const createContract =
  ({ wallet, restClient }: ContractsDI) =>
  async (createContractRequest: CreateContractRequest): Promise<[ContractId, TxId]> => {
    const addressesAndCollaterals = await getAddressesAndCollaterals(wallet);

    const baseRequest: BuildCreateContractTxRequestOptions = {
      version: "v1",

      changeAddress: addressesAndCollaterals.changeAddress,
      usedAddresses: addressesAndCollaterals.usedAddresses,
      collateralUTxOs: addressesAndCollaterals.collateralUTxOs,
      stakeAddress: createContractRequest.stakeAddress,

      threadRoleName: createContractRequest.threadRoleName,
      roles: createContractRequest.roles,

      tags: createContractRequest.tags,
      metadata: createContractRequest.metadata,
      minimumLovelaceUTxODeposit: createContractRequest.minimumLovelaceUTxODeposit,
    };

    let restClientRequest: BuildCreateContractTxRequest;
    if ("contract" in createContractRequest) {
      restClientRequest = {
        ...baseRequest,

        contract: createContractRequest.contract,
      };
    } else {
      const contractSources = await restClient.createContractSources({
        bundle: createContractRequest.bundle,
      });
      restClientRequest = {
        ...baseRequest,
        sourceId: contractSources.contractSourceId,
      };
    }
    const buildCreateContractTxResponse = await restClient.buildCreateContractTx(restClientRequest);
    const contractId = buildCreateContractTxResponse.contractId;

    const hexTransactionWitnessSet = await wallet.signTx(buildCreateContractTxResponse.tx.cborHex);

    await restClient.submitContract({
      contractId,
      txEnvelope: transactionWitnessSetTextEnvelope(hexTransactionWitnessSet),
    });
    return [contractId, contractIdToTxId(contractId)];
  };

const applyInputsTx =
  ({ wallet, deprecatedRestAPI }: ContractsDI) =>
  async (contractId: ContractId, applyInputsRequest: ApplyInputsRequest): Promise<TxId> => {
    return unsafeTaskEither(applyInputsTxFpTs(deprecatedRestAPI)(wallet)(contractId)(applyInputsRequest));
  };

const getApplicableInputs =
  ({ wallet, deprecatedRestAPI }: ContractsDI) =>
  async (contractId: ContractId, environement: Environment): Promise<Next> => {
    const contractDetails = await unsafeTaskEither(deprecatedRestAPI.contracts.contract.get(contractId));
    if (!contractDetails.state) {
      return noNext;
    } else {
      const parties = await getParties(wallet)(contractDetails.roleTokenMintingPolicyId);
      return await unsafeTaskEither(deprecatedRestAPI.contracts.contract.next(contractId)(environement)(parties));
    }
  };

const getContractIds =
  ({ deprecatedRestAPI, wallet }: ContractsDI) =>
  async (): Promise<ContractId[]> => {
    const partyAddresses = [await wallet.getChangeAddress(), ...(await wallet.getUsedAddresses())];
    const kwargs = { tags: [], partyAddresses, partyRoles: [] };
    const loop = async (acc: ContractId[], range?: ItemRange): Promise<ContractId[]> => {
      const result = await deprecatedRestAPI.contracts.getHeadersByRange(range)(kwargs)();
      if (result._tag === "Left") throw result.left;
      const response = result.right;
      const contractIds = [...acc, ...response.contracts.map(({ contractId }) => contractId)];
      return response.page.next ? loop(contractIds, response.page.next) : contractIds;
    };
    return loop([]);
  };

const getParties: (walletApi: WalletAPI) => (roleTokenMintingPolicyId: PolicyId) => Promise<Party[]> =
  (walletAPI) => async (roleMintingPolicyId) => {
    const changeAddress: Party = await walletAPI
      .getChangeAddress()
      .then((addressBech32) => ({ address: addressBech32 }));
    const usedAddresses: Party[] = await walletAPI.getUsedAddresses().then((addressesBech32) =>
      addressesBech32.map((addressBech32) => ({
        address: addressBech32,
      }))
    );
    const roles: Party[] = (await walletAPI.getTokens())
      .filter((token) => token.assetId.policyId == roleMintingPolicyId)
      .map((token) => ({ role_token: token.assetId.policyId }));
    return roles.concat([changeAddress]).concat(usedAddresses);
  };

export const applyInputsTxFpTs: (
  client: FPTSRestAPI
) => (
  wallet: WalletAPI
) => (
  contractId: ContractId
) => (applyInputsRequest: ApplyInputsRequest) => TE.TaskEither<Error | DecodingError, TxId> =
  (client) => (wallet) => (contractId) => (applyInputsRequest) =>
    pipe(
      tryCatchDefault(() => getAddressesAndCollaterals(wallet)),
      TE.chain((addressesAndCollaterals: AddressesAndCollaterals) =>
        client.contracts.contract.transactions.post(
          contractId,
          {
            inputs: applyInputsRequest.inputs,
            version: "v1",
            tags: applyInputsRequest.tags ? applyInputsRequest.tags : {},
            metadata: applyInputsRequest.metadata ? applyInputsRequest.metadata : {},
            invalidBefore: applyInputsRequest.invalidBefore,
            invalidHereafter: applyInputsRequest.invalidHereafter,
          },
          addressesAndCollaterals
        )
      ),
      TE.chainW((transactionTextEnvelope: TransactionTextEnvelope) =>
        pipe(
          tryCatchDefault(() => wallet.signTx(transactionTextEnvelope.tx.cborHex)),
          TE.chain((hexTransactionWitnessSet: HexTransactionWitnessSet) =>
            client.contracts.contract.transactions.transaction.put(
              contractId,
              transactionTextEnvelope.transactionId,
              hexTransactionWitnessSet
            )
          ),
          TE.map(() => transactionTextEnvelope.transactionId)
        )
      )
    );

export const applyInputsFpTs: (
  client: FPTSRestAPI
) => (
  wallet: WalletAPI
) => (
  contractId: ContractId
) => (applyInputsRequest: ApplyInputsRequest) => TE.TaskEither<Error | DecodingError, TxId> =
  (client) => (wallet) => (contractId) => (applyInputsRequest) =>
    pipe(
      applyInputsTxFpTs(client)(wallet)(contractId)(applyInputsRequest),
      TE.chainW((txId) => tryCatchDefault(() => wallet.waitConfirmation(txId).then((_) => txId)))
    );
