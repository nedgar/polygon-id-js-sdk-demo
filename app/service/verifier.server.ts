import { auth, loaders, protocol, resolver } from "@iden3/js-iden3-auth";
import {
  AuthorizationRequestMessage,
  AuthorizationResponseMessage,
  CircuitId,
  ICircuitStorage,
  PROTOCOL_CONSTANTS,
  ZeroKnowledgeProofRequest,
} from "@0xpolygonid/js-sdk";
import { randomUUID } from "crypto";
import { Alpha2Code } from "i18n-iso-countries";
import invariant from "tiny-invariant";

import { getNumericCountryCode } from "./countries.server";
import { credentialWallet, dataStorage, identityWallet } from "./identity.server";
import { initServices } from "./services.server";
import config from "~/config.server";
import { getCircuitStorage } from "./circuits.server";

const KYC_CONTEXT_URL =
  "https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v3.json-ld";

export enum ChallengeType {
  COUNTRY_NOT_SANCTIONED = "countryNotSanctioned",
  USER_IS_ADULT = "userIsAdult",
}

export function getAuthRequestMessage(verifierDID: string, challengeType: ChallengeType) {
  switch (challengeType) {
    case ChallengeType.COUNTRY_NOT_SANCTIONED:
      return getAuthRequest(
        verifierDID,
        getCountryNotSanctionedProofRequest(),
        "Verify country of residence is not sanctioned."
      );
    case ChallengeType.USER_IS_ADULT:
      return getAuthRequest(
        verifierDID,
        getUserIsAdultProofRequest(),
        "Verify user is at least 21 years old."
      );
    default:
      throw new Error("Unsupported challenge type");
  }
}

function getCountryNotSanctionedProofRequest(): ZeroKnowledgeProofRequest {
  const sanctionedCountries: Alpha2Code[] = [
    "AF", // Afghanistan,
    "IR", // Iran
    "KP", // North Korea
    "SS", // South Sudan
    "SY", // Syria
  ];

  const countryCodes = sanctionedCountries.map(getNumericCountryCode);
  return {
    id: 2,
    circuitId: CircuitId.AtomicQuerySigV2,
    optional: false,
    query: {
      allowedIssuers: ["*"],
      type: "KYCCountryOfResidenceCredential",
      context: KYC_CONTEXT_URL,
      credentialSubject: {
        countryCode: {
          $nin: countryCodes,
        },
      },
    },
  };
}

function getUserIsAdultProofRequest(): ZeroKnowledgeProofRequest {
  const now = new Date();
  const comparisonDateAsNumber =
    (now.getUTCFullYear() - 21) * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  return {
    id: 1,
    circuitId: CircuitId.AtomicQuerySigV2,
    optional: false,
    query: {
      allowedIssuers: ["*"],
      type: "KYCAgeCredential",
      context: KYC_CONTEXT_URL,
      credentialSubject: {
        birthday: {
          $lt: comparisonDateAsNumber,
        },
      },
    },
  };
}

declare global {
  var __authRequests__: Map<string, AuthorizationRequestMessage>;
}

if (!global.__authRequests__) {
  global.__authRequests__ = new Map();
}

const authRequests = global.__authRequests__;

function getAuthRequest(
  verifierDID: string,
  proofRequest: ZeroKnowledgeProofRequest,
  reason: string
) {
  const threadId = randomUUID();
  const authRequest: AuthorizationRequestMessage = {
    id: threadId, // first message in thread normally has same ID as thread
    thid: threadId,
    typ: PROTOCOL_CONSTANTS.MediaType.PlainMessage,
    from: verifierDID,
    type: PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE,
    body: {
      callbackUrl: "http://wallet.example.org/callback",
      message: "message to sign",
      scope: [proofRequest],
      reason,
    },
  };

  // TODO: remember the request to validate the subsequent response

  authRequests.set(threadId, authRequest);

  return authRequest;
}

class VerificationKeyLoader implements loaders.IKeyLoader {
  constructor(private readonly _circuitStorage: ICircuitStorage) {}

  async load(circuitId: string): Promise<Uint8Array> {
    const { verificationKey } = await this._circuitStorage.loadCircuitData(circuitId as CircuitId);
    return verificationKey;
  }
}

async function getAuthVerifier() {
  const verificationKeyloader = new VerificationKeyLoader(await getCircuitStorage());
  const schemaLoader = new loaders.UniversalSchemaLoader("ipfs.io");

  const ethStateResolver = new resolver.EthStateResolver(config.rpcUrl, config.contractAddress);
  const resolvers: resolver.Resolvers = {
    ["polygon:mumbai"]: ethStateResolver,
  };
  return new auth.Verifier(verificationKeyloader, schemaLoader, resolvers);
}

export async function verifyAuthResponse(authToken: string): Promise<boolean> {
  // TODO: check that the received response is actually in response to an earlier request that was sent

  const { packageManager } = await initServices(
    identityWallet,
    credentialWallet,
    dataStorage.states
  );

  const envelope = new TextEncoder().encode(authToken);
  const { unpackedMediaType, unpackedMessage } = await packageManager.unpack(envelope);
  console.log("unpacked:", { unpackedMediaType, unpackedMessage });

  invariant(unpackedMessage.thid, "missing thread ID");

  const authRequest = authRequests.get(unpackedMessage.thid);
  invariant(authRequest, "no auth request found for thread ID");

  const verifier = await getAuthVerifier();
  await verifier.verifyAuthResponse(
    unpackedMessage as protocol.AuthorizationResponseMessage,
    authRequest as protocol.AuthorizationRequestMessage
  );

  return true;
}
