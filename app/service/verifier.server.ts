import { auth, loaders, protocol, resolver } from "@iden3/js-iden3-auth";
import {
  AuthorizationRequestMessage,
  CircuitId,
  ICircuitStorage,
  PROTOCOL_CONSTANTS,
  ZeroKnowledgeProofRequest,
} from "@0xpolygonid/js-sdk";
import { randomUUID } from "crypto";
import { Alpha2Code } from "i18n-iso-countries";
import invariant from "tiny-invariant";

import { ChallengeType } from "~/shared/challenge-type";

import { getNumericCountryCode } from "./countries.server";
import { credentialWallet, dataStorage, identityWallet } from "./identity.server";
import { initServices } from "./services.server";
import config from "~/config.server";
import { getCircuitStorage } from "./circuits.server";
import { getNumericCurrencyCode } from "./currencies.server";

const FIN_ASSETS_CONTEXT_URL =
  "https://raw.githubusercontent.com/nedgar/polygon-id-js-sdk-demo/main/schemas/json-ld/AssetsUnderManagement-v1.json-ld";
const KYC_CONTEXT_URL =
  "https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v3.json-ld";
const PASSPORT_CONTEXT_URL =
  "https://raw.githubusercontent.com/nedgar/polygon-id-js-sdk-demo/main/schemas/json-ld/Passport-v1.json-ld";

export function getAuthRequestMessage(verifierDID: string, challengeType: ChallengeType) {
  switch (challengeType) {
    case ChallengeType.FIN_AUM_OVER_THRESHOLD:
      return getAuthRequest(
        verifierDID,
        "Verify total assets under management is over threshold.",
        ...getFinancialAUMRequests("$gt", "SGD", 200_000)
      );
    case ChallengeType.ID_PASSPORT_MATCHES:
      return getAuthRequest(
        verifierDID,
        "Verify passport number matches and issuing country is not sanctioned.",
        ...getPassportMatchesRequests()
      );
    case ChallengeType.KYC_COUNTRY_NOT_SANCTIONED:
      return getAuthRequest(
        verifierDID,
        "Verify country of residence is not sanctioned.",
        getCountryNotSanctionedProofRequest()
      );
    case ChallengeType.KYC_DISCLOSE_BIRTHDAY:
      return getAuthRequest(
        verifierDID,
        "Disclose birthday (selective disclosure).",
        getDiscloseBirthdayRequest()
      );
    case ChallengeType.KYC_USER_IS_ADULT:
      return getAuthRequest(
        verifierDID,
        "Verify user is at least 21 years old.",
        getUserIsAdultProofRequest()
      );
    default:
      throw new Error("Unsupported challenge type");
  }
}

const sanctionedCountries: Alpha2Code[] = [
  "AF", // Afghanistan,
  "IR", // Iran
  "KP", // North Korea
  "SS", // South Sudan
  "SY", // Syria
];

function getCountryNotSanctionedProofRequest(): ZeroKnowledgeProofRequest {
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
          $nin: sanctionedCountries.map(getNumericCountryCode),
        },
      },
    },
  };
}

function getFinancialAUMRequests(
  operator: string,
  currencyCode: string,
  amount: number
): ZeroKnowledgeProofRequest[] {
  return [
    {
      id: 6,
      circuitId: CircuitId.AtomicQuerySigV2,
      optional: false,
      query: {
        allowedIssuers: ["*"],
        type: "AssetsUnderManagement",
        context: FIN_ASSETS_CONTEXT_URL,
        credentialSubject: {
          currencyCode: {
            $eq: getNumericCurrencyCode(currencyCode),
          },
        },
      },
    },
    {
      id: 7,
      circuitId: CircuitId.AtomicQuerySigV2,
      optional: false,
      query: {
        allowedIssuers: ["*"],
        type: "AssetsUnderManagement",
        context: FIN_ASSETS_CONTEXT_URL,
        credentialSubject: {
          valuation: {
            [operator]: amount,
          },
        },
      },
    },
  ];
}

function getPassportMatchesRequests(): ZeroKnowledgeProofRequest[] {
  const passportNumber = "L898902C3";
  return [
    {
      id: 3,
      circuitId: CircuitId.AtomicQuerySigV2,
      optional: false,
      query: {
        allowedIssuers: ["*"],
        type: "PassportCredential",
        context: PASSPORT_CONTEXT_URL,
        credentialSubject: {
          passportNumber: {
            $eq: passportNumber,
          },
        },
      },
    },
    {
      id: 4,
      circuitId: CircuitId.AtomicQuerySigV2,
      optional: false,
      query: {
        allowedIssuers: ["*"],
        type: "PassportCredential",
        context: PASSPORT_CONTEXT_URL,
        credentialSubject: {
          countryCode: {
            $nin: sanctionedCountries.map(getNumericCountryCode),
          },
        },
      },
    },
  ];
}

function getDiscloseBirthdayRequest(): ZeroKnowledgeProofRequest {
  return {
    id: 1,
    circuitId: CircuitId.AtomicQuerySigV2,
    optional: false,
    query: {
      allowedIssuers: ["*"],
      type: "KYCAgeCredential",
      context: KYC_CONTEXT_URL,
      credentialSubject: {
        birthday: {},
      },
    },
  };
}

function getUserIsAdultProofRequest(): ZeroKnowledgeProofRequest {
  const now = new Date();

  // Subtract 21 years and add one day (if today is their birthday, it counts).
  // This does increment month if needed.
  // Caveat: should really use user's local time, not UTC.
  const dt = new Date(now.getUTCFullYear() - 21, now.getUTCMonth(), now.getUTCDay() + 1);

  const comparisonDateAsNumber =
    (dt.getUTCFullYear()) * 10000 + (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate();
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
  reason: string,
  ...proofRequests: ZeroKnowledgeProofRequest[]
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
      scope: proofRequests,
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
