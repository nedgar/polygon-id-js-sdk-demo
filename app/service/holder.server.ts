import type {
  AuthorizationRequestMessage,
  AuthorizationResponseMessage,
  JSONObject,
  W3CCredential,
  ZeroKnowledgeProofRequest,
} from "@0xpolygonid/js-sdk";
import { Poseidon } from "@iden3/js-crypto";
import { DID } from "@iden3/js-iden3-core";
import { Token } from "@iden3/js-jwz";
import invariant from "tiny-invariant";

import { credentialWallet, dataStorage, identityWallet } from "./identity.server";
import { initServices } from "./services.server";

export interface HolderThreadState {
  selectedCredential: W3CCredential;
  authResponse: AuthorizationResponseMessage;
  token: string;
  tokenDecoded: JSONObject;
}

declare global {
  var __holderThreadStates__: Map<string, HolderThreadState>;
}

if (!global.__holderThreadStates__) {
  global.__holderThreadStates__ = new Map();
}

const threadStates = global.__holderThreadStates__;

export function clearHolderThreadState(threadId: string) {
  threadStates.delete(threadId);
}

export function getHolderThreadState(threadId: string) {
  return threadStates.get(threadId);
}

function setHolderThreadState(threadId: string, threadState: HolderThreadState) {
  threadStates.set(threadId, threadState);
}

export async function generateAuthResponse(
  userDID: string,
  authRequest: AuthorizationRequestMessage,
  credentialId: string
): Promise<{
  token: string;
}> {
  invariant(authRequest.thid, "missing thread ID");
  const scope = authRequest.body?.scope;
  invariant(
    Array.isArray(scope) && scope.length >= 1,
    "auth request scope must have at least one ZKP request"
  );

  const credential = await credentialWallet.findById(credentialId);
  invariant(credential, `credential not found: ${credentialId}`);

  const { authHandler } = await initServices(identityWallet, credentialWallet, dataStorage.states);

  // const requestsWithCreds: ZKPRequestWithCredential[] = scope.map((req) => ({
  //   req: hashQueryValueIfNeeded(req),
  //   credential,
  //   credentialSubjectProfileNonce: 0,
  // }));

  // const authProfileNonce = 0;
  // const result = await authHandler.generateAuthorizationResponse(
  //   DID.parse(userDID),
  //   authProfileNonce,
  //   authRequest,
  //   requestsWithCreds
  // );

  // FIXME: As of js-sdk v1.0.2, IAuthHandler no longer supports generating an auth response for a given credential,
  // and the code above no longer works.
  // For now we fall back to letting it handle the whole request, ignoring the user's choice of credential.
  // There should only be one credential for a given schema anyway -- any duplicates should be equivalent. 
  // We should prevent holding multiple credentials for a given schema and type anyway.

  const authRequestBytes = new TextEncoder().encode(JSON.stringify(authRequest));
  const result = await authHandler.handleAuthorizationRequest(DID.parse(userDID), authRequestBytes);
  console.log("[generateAuthResponse] result.authResponse:", JSON.stringify(result.authResponse, null, 2));

  // parse the token to show in UI
  const parsedToken = await Token.parse(result.token);
  const tokenDecoded: JSONObject = {
    headers: JSON.parse(parsedToken.serializeHeaders()),
    payload: JSON.parse(parsedToken.getPayload()),
    zkProof: parsedToken.zkProof,
  };

  setHolderThreadState(authRequest.thid, {
    selectedCredential: credential,
    authResponse: result.authResponse,
    token: result.token,
    tokenDecoded,
  });

  return {
    token: result.token,
  };
}

function parseQuerySubject(subject: any) {
  invariant(typeof subject === "object");

  const [fieldName, ...otherFields] = Object.keys(subject);
  invariant(otherFields.length === 0);

  const [op, ...otherOps] = Object.keys(subject[fieldName]);
  invariant(otherOps.length === 0);

  const value = (subject[fieldName] as any)[op];
  return [fieldName, op, value];
}

function poseidonHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  return Poseidon.hashBytes(bytes);
}

function hashQueryValueIfNeeded(req: ZeroKnowledgeProofRequest): ZeroKnowledgeProofRequest {
  const {
    query: { credentialSubject, ...queryRest },
    ...reqRest
  } = req;

  const [fieldName, op, value] = parseQuerySubject(credentialSubject);

  if (fieldName === "passportNumber" && typeof value === "string") {
    return {
      query: {
        credentialSubject: {
          [fieldName]: { [op]: poseidonHash(value).toString() },
        },
        ...queryRest,
      },
      ...reqRest,
    };
  }

  return req;
}
