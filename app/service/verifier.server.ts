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

import { ChallengeType } from "~/shared/challenge-type";
import { getNumericCountryCode } from "~/shared/countries";
import { getNumericCurrencyCode } from "~/shared/currencies";

import { credentialWallet, dataStorage, identityWallet } from "./identity.server";
import { initServices } from "./services.server";
import config from "~/config.server";
import { getCircuitStorage } from "./circuits.server";

const CCG_TRACEABILITY_CONTEXT_URL =
  "https://w3c-ccg.github.io/traceability-vocab/contexts/traceability-v1.jsonld";
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
    case ChallengeType.FIN_DISCLOSE_BANK_ACCOUNT:
      return getAuthRequest(verifierDID, "Verify bank account.", getFinancialBankAccountRequest());
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
    circuitId: CircuitId.AtomicQuerySigV2, // "credentialAtomicQuerySigV2OnChain"
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

function getFinancialBankAccountRequest(): ZeroKnowledgeProofRequest {
  return {
    id: 8,
    circuitId: CircuitId.AtomicQuerySigV2,
    optional: false,
    query: {
      allowedIssuers: ["*"],
      type: "BankAccount",
      context: CCG_TRACEABILITY_CONTEXT_URL,
      credentialSubject: {
        accountId: {},
      },
    },
  };
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
    id: 101,
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
  const dt = new Date(now.getUTCFullYear() - 21, now.getUTCMonth(), now.getUTCDate() + 1);

  const comparisonDateAsNumber =
    dt.getUTCFullYear() * 10000 + (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate();
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

export function getAuthRequestForThread(threadId: string) {
  return authRequests.get(threadId);
}

export function clearAuthRequestForThread(threadId: string): boolean {
  return authRequests.delete(threadId);
}

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

export type VerifyAuthResponseChecks = {
  tokenSyntax?: boolean;
  mediaType?: boolean;
  requestExists?: boolean;
  authVerified?: boolean;
};

export type VerifyAuthResponseResult = {
  authRequest?: AuthorizationRequestMessage;
  authResponse?: AuthorizationResponseMessage;
  checks: VerifyAuthResponseChecks;
  errors: string[];
};

export async function verifyAuthResponse(authToken: string): Promise<VerifyAuthResponseResult> {
  // TODO: check that the received response is actually in response to an earlier request that was sent

  const { packageManager } = await initServices(
    identityWallet,
    credentialWallet,
    dataStorage.states
  );

  const checks: VerifyAuthResponseChecks = {};
  const errors: string[] = [];

  let authRequest: AuthorizationRequestMessage | undefined;
  let authResponse: AuthorizationResponseMessage | undefined;

  try {
    const envelope = new TextEncoder().encode(authToken);
    checks.tokenSyntax = false;
    const { unpackedMediaType, unpackedMessage } = await packageManager.unpack(envelope);
    checks.tokenSyntax = true;

    checks.mediaType = unpackedMediaType === PROTOCOL_CONSTANTS.MediaType.ZKPMessage;
    if (!checks.mediaType) {
      throw new Error(`Unexpected media type: ${unpackedMediaType}`);
    }

    // console.log("unpacked:", { unpackedMediaType, unpackedMessage });

    if (!unpackedMessage.thid) {
      throw new Error("Missing thread ID");
    }

    authRequest = getAuthRequestForThread(unpackedMessage.thid);
    checks.requestExists = !!authRequest;
    if (!authRequest) {
      throw Error("No auth request found for thread ID");
    }

    authResponse = unpackedMessage as AuthorizationResponseMessage;
    const verifier = await getAuthVerifier();
    checks.authVerified = false;

    await verifier.verifyAuthResponse(
      authResponse as protocol.AuthorizationResponseMessage,
      authRequest as protocol.AuthorizationRequestMessage
    );
    checks.authVerified = true;
  } catch (err: any) {
    console.error("Error in verifyAuthResponse:", err);
    errors.push(err?.message ?? "Unknown error in verifyAuthResponse");
  }
  return { authRequest, authResponse, checks, errors };
}
