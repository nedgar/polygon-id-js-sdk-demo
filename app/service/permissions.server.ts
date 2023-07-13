import invariant from "tiny-invariant";
import { ChallengeType } from "~/shared/challenge-type";
import { getRequiredProofIdsForChallenge } from "./auth-requests";
import { ProofRequestId } from "./proof-requests";

export enum PermissionId {
  CAN_OPEN_NEW_ACCOUNT = "CAN_OPEN_NEW_ACCOUNT",
  CAN_OPEN_CROSS_BORDER_ACCOUNT = "CAN_OPEN_CROSS_BORDER_ACCOUNT",
}

export interface Permission {
  id: PermissionId;
  name: string;
  challengeTypes: ChallengeType[];
}

const PERMISSIONS: Permission[] = [
  {
    id: PermissionId.CAN_OPEN_NEW_ACCOUNT,
    name: "Can Open New Account",
    challengeTypes: [ChallengeType.KYC_USER_IS_ADULT, ChallengeType.KYC_COUNTRY_NOT_SANCTIONED],
  },
  {
    id: PermissionId.CAN_OPEN_CROSS_BORDER_ACCOUNT,
    name: "Can Open Cross-Border Account",
    challengeTypes: [ChallengeType.FIN_DISCLOSE_BANK_ACCOUNT, ChallengeType.ID_PASSPORT_MATCHES],
  },
];

export function getAvailablePermissions() {
  return PERMISSIONS;
}

export function getRequiredProofIds(permissionId: PermissionId) {
  const perm = PERMISSIONS.find((p) => p.id === permissionId);
  invariant(perm, "Unsupported permission ID");

  const proofIds: ProofRequestId[] = [];
  for (const challengeType of perm.challengeTypes) {
    for (const proofId of getRequiredProofIdsForChallenge(challengeType)) {
      if (!proofIds.includes(proofId)) {
        proofIds.push(proofId);
      }
    }
  }
  return proofIds;
}
