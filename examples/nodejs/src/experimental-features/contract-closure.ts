import { Contract } from "@marlowe.io/language-core-v1";
import { ContractSourceId } from "@marlowe.io/marlowe-object";
import { RestClient } from "@marlowe.io/runtime-rest-client";

export interface ContractClosure {
  main: string;
  contracts: Map<string, Contract>;
}

type ClosureDI = { restClient: RestClient };

// TODO: Candidate for runtime lifecycle helper
export const getContractClosure =
  ({ restClient }: ClosureDI) =>
  async (contractSourceId: ContractSourceId): Promise<ContractClosure> => {
    const ids = await restClient.getContractSourceClosure({
      contractSourceId,
    });
    const objectEntries = await Promise.all(
      ids.results.map((id) => restClient.getContractSourceById({ contractSourceId: id }).then((c) => [id, c] as const))
    );
    return {
      main: contractSourceId,
      contracts: new Map(objectEntries),
    };
  };
