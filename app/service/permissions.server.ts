import { ChallengeType } from "~/shared/challenge-type";

export interface Permission {
  id: string;
  name: string;
  challengeType: ChallengeType;
}

export interface UserPermission {
  permission: Permission;
  granted: boolean;
}

const PERMISSIONS: Permission[] = [
  {
    id: "CAN_OPEN_NEW_ACCOUNT",
    name: "Can Open New Account",
    challengeType: ChallengeType.KYC_COUNTRY_NOT_SANCTIONED,
  },
  {
    id: "CAN_OPEN_CROSS_BORDER_ACCOUNT",
    name: "Can Open Cross-Border Account",
    challengeType: ChallengeType.FIN_DISCLOSE_BANK_ACCOUNT,
  },
  {
    id: "CAN_TRADE_STABLECOIN",
    name: "Can Trade Stablecoin On-chain",
    challengeType: ChallengeType.FIN_DISCLOSE_BANK_ACCOUNT,
  },
];

export function getAvailablePermissions() {
  return PERMISSIONS;
}

export function getUserPermissionsForChallengeType(challengeType: ChallengeType): UserPermission[] {
  return getAvailablePermissions()
    .filter((p) => p.challengeType === challengeType)
    .map((p) => ({
      permission: p,
      granted: false,
    }));
}

// export function getRequiredProofIds(permissionId: string) {
//   const perm = PERMISSIONS.find((p) => p.id === permissionId);
//   invariant(perm, "Unsupported permission ID");

//   const proofIds: ProofRequestId[] = [];
//   for (const proofId of getRequiredProofIdsForChallenge(perm.challengeType)) {
//     if (!proofIds.includes(proofId)) {
//       proofIds.push(proofId);
//     }
//   }
//   return proofIds;
// }
