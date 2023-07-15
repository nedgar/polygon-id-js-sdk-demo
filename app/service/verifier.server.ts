import type {
  AuthorizationRequestMessage,
  AuthorizationResponseMessage,
  CircuitId,
  ICircuitStorage
} from "@0xpolygonid/js-sdk";
import {
  PROTOCOL_CONSTANTS
} from "@0xpolygonid/js-sdk";
import type { loaders, protocol } from "@iden3/js-iden3-auth";
import { auth, resolver } from "@iden3/js-iden3-auth";

import config from "~/config.server";
import type { ChallengeType } from "~/shared/challenge-type";
import { getAuthRequest } from "./auth-requests";
import { getCircuitStorage } from "./circuits.server";
import { credentialWallet, dataStorage, identityWallet } from "./identity.server";
import { initServices } from "./services.server";

export const VERIFIER_DID =
  "did:polygonid:polygon:mumbai:2qMFtSnvRGKFDVY5MawZENXv6eAQnGgKTNwid1wJoG";

export interface VerifierThreadState {
  challengeType: ChallengeType;
  authRequest: AuthorizationRequestMessage;
  authResponse?: AuthorizationResponseMessage;
  verifierChecks?: VerifyAuthResponseChecks;
}

declare global {
  var __verifierThreadStates__: Map<string, VerifierThreadState>;
}

if (!global.__verifierThreadStates__) {
  global.__verifierThreadStates__ = new Map();
}

const threadStates = global.__verifierThreadStates__;

export function getVerifierThreadState(threadId: string) {
  return threadStates.get(threadId);
}

function setVerifierThreadState(threadId: string, state: VerifierThreadState) {
  return threadStates.set(threadId, state);
}

export function getUserDIDs() {
  const dids: Set<string> = new Set();
  for (const thread of threadStates.values()) {
    if (thread.authResponse?.from) {
      dids.add(thread.authResponse.from);
    }
  }
  return Array.from(dids);
}

export function getUserThreads(did: string): VerifierThreadState[] {
  return Array.from(threadStates.values()).filter((thread) => thread.authResponse?.from === did);
}

export function getAuthRequestMessage(verifierDID: string, challengeType: ChallengeType) {
  const authRequest = getAuthRequest(verifierDID, challengeType);
  setVerifierThreadState(authRequest.thid!, {
    challengeType,
    authRequest,
  });
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

  const ethStateResolver = new resolver.EthStateResolver(config.rpcUrl, config.contractAddress);
  const resolvers: resolver.Resolvers = {
    "polygon:mumbai": ethStateResolver, // TODO: allow multiple blockchain / network resolvers
  };
  return auth.Verifier.newVerifier(verificationKeyloader, resolvers);
}

export type VerifyAuthResponseChecks = {
  tokenSyntax?: boolean;
  mediaType?: boolean;
  requestExists?: boolean;
  authVerified?: boolean;
};

export type VerifyAuthResponseResult = {
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

    const threadState = getVerifierThreadState(unpackedMessage.thid);
    if (!threadState) {
      throw Error("Thread not found");
    }
    checks.requestExists = !!threadState.authRequest;
    if (!checks.requestExists) {
      throw Error("No auth request found for thread ID");
    }

    authResponse = unpackedMessage as AuthorizationResponseMessage;
    const verifier = await getAuthVerifier();
    checks.authVerified = false;

    await verifier.verifyAuthResponse(
      authResponse as protocol.AuthorizationResponseMessage,
      threadState.authRequest as protocol.AuthorizationRequestMessage
    );
    checks.authVerified = true;

    setVerifierThreadState(unpackedMessage.thid, {
      ...threadState,
      authResponse,
      verifierChecks: checks,
    });
  } catch (err: any) {
    console.error("Error in verifyAuthResponse:", err);
    errors.push(err?.message ?? "Unknown error in verifyAuthResponse");
  }
  return { checks, errors };
}
