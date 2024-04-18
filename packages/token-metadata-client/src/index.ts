export interface TokenMetadata {
  /** A human-readable name for the subject, suitable for use in an interface. */
  name: string;
  /** A human-readable description for the subject, suitable for use in an interface. */
  description: string;
  /** The base16-encoded CBOR representation of the monetary policy script, used to verify ownership. Optional in the case of Plutus scripts as verification is handled elsewhere. */
  policy?: string;
  /** A human-readable ticker name for the subject, suitable for use in an interface. */
  ticker?: string;
  /** A HTTPS URL (web page relating to the token). */
  url?: string;
  /** A PNG image file as a byte string. */
  logo?: string;
  /** How many decimals to the token. */
  decimals?: number;
}

interface TokenMetadataJSONResponse {
  name: { value: string };
  description: { value: string };
  policy?: string;
  ticker?: { value: string };
  url?: { value: string };
  logo?: { value: string };
  decimals?: { value: number };
}

const cardano_foundation_server_url =
  "https://raw.githubusercontent.com/cardano-foundation/cardano-token-registry/master/mappings/";
const iohk_server_url = "https://raw.githubusercontent.com/input-output-hk/metadata-registry-testnet/master/registry/";

export const lookupTokenMetadata = async (
  policyId: string,
  assetName: string,
  network: "mainnet" | "preview" | "preprod"
): Promise<TokenMetadata> => {
  if (policyId === "" && assetName === "") {
    return {
      decimals: 6,
      ticker: network === "mainnet" ? "₳" : "t₳",
      name: "Ada",
      description: "Cardano ADA",
    };
  } else {
    const server_url = network === "mainnet" ? cardano_foundation_server_url : iohk_server_url;
    const response = await fetch(`${server_url}/${policyId + assetName}.json`);
    const json: TokenMetadataJSONResponse = await response.json();
    return {
      name: json.name.value,
      description: json.description.value,
      policy: json.policy,
      ticker: json.ticker?.value,
      url: json.url?.value,
      logo: json.logo?.value,
      decimals: json.decimals?.value,
    };
  }
};

export const formatToken = ({ decimals, ticker, name }: TokenMetadata, value: number): string =>
  `${value * 10 ** -(decimals || 0)} ${ticker || name}`;
