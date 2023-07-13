import {
  AuthorizationRequestMessage,
  PROTOCOL_CONSTANTS,
  ZeroKnowledgeProofRequest,
} from "@0xpolygonid/js-sdk";
import { randomUUID } from "crypto";

import { ChallengeType } from "~/shared/challenge-type";
import {
    ProofRequestId,
  getCountryNotSanctionedProofRequest,
  getDiscloseBirthdayRequest,
  getFinancialAUMRequests,
  getFinancialBankAccountRequest,
  getPassportMatchesRequests,
  getUserIsAdultProofRequest,
} from "./proof-requests";

export function getAuthRequest(verifierDID: string, challengeType: ChallengeType) {
  switch (challengeType) {
    case ChallengeType.FIN_AUM_OVER_THRESHOLD:
      return createAuthRequest(
        verifierDID,
        "Verify total assets under management is over threshold.",
        ...getFinancialAUMRequests("SGD", 200_000)
      );
    case ChallengeType.FIN_DISCLOSE_BANK_ACCOUNT:
      return createAuthRequest(
        verifierDID,
        "Verify bank account.",
        getFinancialBankAccountRequest()
      );
    case ChallengeType.ID_PASSPORT_MATCHES:
      return createAuthRequest(
        verifierDID,
        "Verify passport number matches and issuing country is not sanctioned.",
        ...getPassportMatchesRequests()
      );
    case ChallengeType.KYC_COUNTRY_NOT_SANCTIONED:
      return createAuthRequest(
        verifierDID,
        "Verify country of residence is not sanctioned.",
        getCountryNotSanctionedProofRequest()
      );
    case ChallengeType.KYC_DISCLOSE_BIRTHDAY:
      return createAuthRequest(
        verifierDID,
        "Disclose birthday (selective disclosure).",
        getDiscloseBirthdayRequest()
      );
    case ChallengeType.KYC_USER_IS_ADULT:
      return createAuthRequest(
        verifierDID,
        "Verify user is at least 21 years old.",
        getUserIsAdultProofRequest()
      );
    default:
      throw new Error("Unsupported challenge type");
  }
}

export function getRequiredProofIdsForChallenge(challengeType: ChallengeType): ProofRequestId[] {
  const authRequest = getAuthRequest("did:unused", challengeType);
  return authRequest.body!.scope.filter((req) => !req.optional).map((req) => req.id);
}

function createAuthRequest(
  verifierDID: string,
  reason: string,
  ...proofRequests: ZeroKnowledgeProofRequest[]
): AuthorizationRequestMessage {
  const threadId = randomUUID();
  return {
    id: threadId, // first message in thread normally has same ID as thread
    thid: threadId,
    typ: PROTOCOL_CONSTANTS.MediaType.PlainMessage,
    from: verifierDID,
    type: PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE,
    body: {
      callbackUrl: "http://wallet.example.org/callback",
      message: "message to sign",
      reason,
      scope: proofRequests,
    },
  };
}
