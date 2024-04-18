import * as t from "io-ts/lib/index.js";

import { PolicyId, RoleName } from "@marlowe.io/language-core-v1";

import * as G from "@marlowe.io/language-core-v1/guards";
import { AddressBech32, AddressBech32Guard } from "@marlowe.io/runtime-core";
import { assertGuardEqual, proxy } from "@marlowe.io/adapter/io-ts";

/**
 *  Definition a of Closed Role Tlken
 *  @remarks
 *    - It is only defined by the Address where the token is distributed
 *  @category Roles Configuration
 */
export type ClosedRole = AddressBech32;
export const ClosedRoleGuard: t.Type<ClosedRole, string> = AddressBech32Guard;

/**
 *  Definition of an Open Role Token
 *  @category Roles Configuration
 */
export type OpenRole = "OpenRole";
export const OpenRoleGuard = t.literal("OpenRole");

/**
 *  Construction of an Open Role Token
 *  @category Roles Configuration
 */
export const openRole = "OpenRole";

/**
 *  Definition of the Openness of a Role Token
 *  @category Roles Configuration
 */
export type Openness = ClosedRole | OpenRole;
export const OpennessGuard: t.Type<Openness, string> = t.union([ClosedRoleGuard, OpenRoleGuard]);

/**
 *  @category Roles Configuration
 */
export type UsePolicyWithClosedRoleTokens = PolicyId;

export const UsePolicyWithClosedRoleTokensGuard: t.Type<UsePolicyWithClosedRoleTokens> = G.PolicyId;

/**
 *  @category Roles Configuration
 */
export interface UsePolicyWithOpenRoleTokens {
  script: OpenRole;
  policyId: PolicyId;
  openRoleNames: RoleName[];
}
export const UsePolicyWithOpenRoleTokensGuard: t.Type<UsePolicyWithOpenRoleTokens> = t.type({
  script: OpenRoleGuard,
  policyId: G.PolicyId,
  openRoleNames: t.array(G.RoleName),
});

/**
 *  @category Roles Configuration
 */
export interface TokenMetadataFile {
  name: string;
  src: string;
  mediaType: string;
}

export const TokenMetadataFileGuard: t.Type<TokenMetadataFile> = t.type({
  name: t.string,
  src: t.string,
  mediaType: t.string,
});

/**
 *  Token Metadata (CIP-25)
 *  @category Roles Configuration
 *  @see
 *  - https://github.com/cardano-foundation/CIPs/blob/master/CIP-0025/README.md
 */
export interface TokenMetadata {
  name?: string;
  image?: string;
  mediaType: string;
  description: string;
  files: TokenMetadataFile[];
}

export const TokenMetadataGuard: t.Type<TokenMetadata> = t.intersection([
  t.type({
    mediaType: t.string,
    description: t.string,
    files: t.array(TokenMetadataFileGuard),
  }),
  t.partial({ name: t.string }),
  t.partial({ image: t.string }),
]);

/**
 *  @category Roles Configuration
 */
export interface ClosedNFTWithMetadata {
  address: AddressBech32;
  metadata?: TokenMetadata;
}

/**
 *  @category Roles Configuration
 */
export type Recipient = Openness;

export const RecipientGuard: t.Type<Recipient, string> = t.union([OpenRoleGuard, ClosedRoleGuard]);

/**
 *  @category Roles Configuration
 */
export type TokenQuantity = bigint;

export const TokenQuantityGuard: t.Type<TokenQuantity> = t.bigint;

/**
 *  @category Roles Configuration
 */
export interface RoleTokenConfiguration {
  recipients: { [x: AddressBech32]: TokenQuantity } | { OpenRole: TokenQuantity };
  metadata?: TokenMetadata;
}

export const RoleTokenConfigurationGuard: t.Type<RoleTokenConfiguration> = t.intersection([
  t.type({
    recipients: t.union([t.record(OpenRoleGuard, TokenQuantityGuard), t.record(ClosedRoleGuard, TokenQuantityGuard)]),
  }),
  t.partial({ metadata: TokenMetadataGuard }),
]);

/**
 *  @category Roles Configuration
 */
export type RoleTokenConfigurations = RoleTokenConfiguration | ClosedRole;

export const RoleConfigurationsGuard = t.union([RoleTokenConfigurationGuard, ClosedRoleGuard]);

/**
 *  @category Roles Configuration
 */
export type MintRolesTokens = { [x: RoleName]: RoleTokenConfigurations };

export const MintRolesTokensGuard = assertGuardEqual(
  proxy<MintRolesTokens>(),
  t.record(G.RoleName, RoleConfigurationsGuard)
);

/**
 *  Defines how to configure Roles over Cardano at the creation of a Marlowe Contract.
 *  @see
 *   Smart Constructors are available to ease the configuration:
 *    - {@link @marlowe.io/runtime-rest-client!contract.useMintedRoles}
 *    - {@link @marlowe.io/runtime-rest-client!contract.mintRole}
 *  @category Endpoint : Build Create Contract Tx
 *  @category Roles Configuration
 */
export type RolesConfiguration = UsePolicyWithClosedRoleTokens | UsePolicyWithOpenRoleTokens | MintRolesTokens;

export const RolesConfigurationGuard = t.union([
  UsePolicyWithClosedRoleTokensGuard,
  UsePolicyWithOpenRoleTokensGuard,
  MintRolesTokensGuard,
]);

/**
 * Configure Roles using tokens previously Minted. These Role Tokens are already defined (via an NFT platform, cardano-cli, another Marlowe Contract Created, etc.. )
 * @param policyId The policy Id of All the token roles defined in the Marlowe Contract DSL
 * @param openRoleNames defines all the Roles to be Open (Others will be Closed)
 * @remarks
 * It is under the user's responsability to create and distribute properly these role tokens
 *  - Make sure all the Token Name are minted and match all the Role Names defined in the contract
 *  - Depending on the Marlowe Contract logic, make sure the tokens are distributed to the right wallet
 * When using Open Role Tokens
 *  - Thread Role Token needs to me minted when using Open Roles (by default threadRoleName = "")
 *  - see {@link index.RestClient#buildCreateContractTx | Build Create Contract Tx }
 *  @category Endpoint : Build Create Contract Tx
 *  @category Roles Configuration
 */
export const useMintedRoles = (policyId: PolicyId, openRoleNames?: RoleName[]): RolesConfiguration =>
  openRoleNames
    ? { script: openRole, policyId: policyId, openRoleNames: openRoleNames }
    : (policyId as UsePolicyWithClosedRoleTokens);

/**
 *  Configure the minting of a Role Token.
 *  @param openness where to distribute the token (Either openly or closedly)
 *  @param quantity Quantity of the Closed Role Token (by Default an NFT (==1))
 *  @param metadata Token Metadata of the Token
 *  @category Endpoint : Build Create Contract Tx
 *  @category Roles Configuration
 */
export const mintRole = (
  openness: Openness,
  quantity?: TokenQuantity,
  metadata?: TokenMetadata
): RoleTokenConfiguration =>
  OpenRoleGuard.is(openness)
    ? {
        recipients: { [openRole]: quantity ? quantity : 1n },
        metadata: metadata,
      }
    : {
        recipients: { [openness]: quantity ? quantity : 1n },
        metadata: metadata,
      };
