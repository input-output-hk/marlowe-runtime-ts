import { TokenName } from "@marlowe.io/language-core-v1";
import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle/generic";
import {
  mkFPTSRestClient,
  mkRestClient,
} from "@marlowe.io/runtime-rest-client";
import {
  Context,
  SingleAddressWallet,
  PrivateKeysAsHex,
} from "@marlowe.io/wallet/nodejs";
import { assetIdToString } from "@marlowe.io/runtime-core";
import { WalletAPI } from "@marlowe.io/wallet/api";

const log = (message: string) => console.log(`\t## - ${message}`);
const formatADA = (lovelaces: bigint): String =>
  new Intl.NumberFormat().format(lovelaces / 1_000_000n).concat(" ₳");

export type ProvisionScheme = {
  provider: { adaAmount: bigint };
  swapper: { adaAmount: bigint; tokenAmount: bigint; tokenName: TokenName };
};

export async function provisionAnAdaAndTokenProvider(
  runtimeURL: string,
  walletContext: Context,
  bankPrivateKey: PrivateKeysAsHex,
  scheme: ProvisionScheme
) {
  const deprecatedRestAPI = mkFPTSRestClient(runtimeURL);
  const restClient = mkRestClient(runtimeURL);

  // Generating/Initialising Accounts
  const bank = await SingleAddressWallet.Initialise(
    walletContext,
    bankPrivateKey
  );
  const adaProvider = await SingleAddressWallet.Random(walletContext);
  const tokenProvider = await SingleAddressWallet.Random(walletContext);
  // Check Banks treasury
  const bankBalance = await bank.getLovelaces();
  log(`Bank (${bank.address})`);
  log(`  - ${formatADA(bankBalance)}`);

  expect(bankBalance).toBeGreaterThan(100_000_000);

  // Provisionning
  await bank.provision([
    [adaProvider, scheme.provider.adaAmount],
    [tokenProvider, scheme.swapper.adaAmount],
  ]);

  const tokenValueMinted = await tokenProvider.mintRandomTokens(
    scheme.swapper.tokenName,
    scheme.swapper.tokenAmount
  );

  // Provisionning Checks
  // Ada Provider
  const adaProviderBalance = await adaProvider.getLovelaces();
  log(`Ada Provider (${adaProvider.address}`);
  log(`   - ${formatADA(adaProviderBalance)}`);

  // Token Provider
  const tokenProviderADABalance = await tokenProvider.getLovelaces();
  const tokenBalance = await tokenProvider.tokenBalance(
    tokenValueMinted.assetId
  );

  log(`Token Provider (${tokenProvider.address})`);
  log(`   - ${formatADA(tokenProviderADABalance)}`);
  log(`   - ${tokenBalance} ${assetIdToString(tokenValueMinted.assetId)}`);

  expect(tokenBalance).toBe(scheme.swapper.tokenAmount);

  return {
    adaProvider: adaProvider,
    tokenProvider: tokenProvider,
    tokenValueMinted: tokenValueMinted,
    restClient: restClient,
    runtime: (wallet: WalletAPI) =>
      mkRuntimeLifecycle(deprecatedRestAPI, restClient, wallet),
  };
}

export async function initialiseBankAndverifyProvisionning(
  runtimeURL: string,
  walletContext: Context,
  bankPrivateKey: PrivateKeysAsHex
) {
  const deprecatedRestAPI = mkFPTSRestClient(runtimeURL);
  const restClient = mkRestClient(runtimeURL);

  const bank = await SingleAddressWallet.Initialise(
    walletContext,
    bankPrivateKey
  );
  const bankBalance = await bank.getLovelaces();

  // Check Banks treasury
  log(`Bank (${bank.address})`);
  log(`  - ${formatADA(bankBalance)}`);

  expect(bankBalance).toBeGreaterThan(100_000_000);

  return {
    bank: bank,
    restClient: restClient,
    runtime: mkRuntimeLifecycle(deprecatedRestAPI, restClient, bank),
  };
}
