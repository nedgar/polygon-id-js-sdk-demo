import {
  AuthorizationRequestMessage,
  AuthorizationResponseMessage,
  JSONObject,
  W3CCredential,
  ZKPRequestWithCredential,
  ZeroKnowledgeProofRequest,
} from "@0xpolygonid/js-sdk";
import { Poseidon } from "@iden3/js-crypto";
import { DID } from "@iden3/js-iden3-core";
import { Token } from "@iden3/js-jwz";

import invariant from "tiny-invariant";

import { credentialWallet, dataStorage, identityWallet } from "./identity.server";
import { initServices } from "./services.server";

export async function generateAuthResponse(
  userDID: string,
  authRequest: AuthorizationRequestMessage,
  credentialId: string
): Promise<{
  token: string;
  authRequest: AuthorizationRequestMessage;
  authResponse: AuthorizationResponseMessage;
  tokenDecoded: any;
  credential: W3CCredential;
}> {
  const scope = authRequest.body?.scope;
  invariant(
    Array.isArray(scope) && scope.length === 1,
    "auth request scope must be a single ZKP request"
  );

  const credential = await credentialWallet.findById(credentialId);
  invariant(credential, `credential not found: ${credentialId}`);

  const reqWithCred: ZKPRequestWithCredential = {
    req: hashQueryValueIfNeeded(scope[0]),
    credential,
    credentialSubjectProfileNonce: 0,
  };

  const { authHandler } = await initServices(identityWallet, credentialWallet, dataStorage.states);

  const authProfileNonce = 0;
  const result = await authHandler.generateAuthorizationResponse(
    DID.parse(userDID),
    authProfileNonce,
    authRequest,
    [reqWithCred]
  );

  // parse the token to show in UI
  const parsedToken = await Token.parse(result.token);
  return {
    ...result,
    tokenDecoded: {
      headers: JSON.parse(parsedToken.serializeHeaders()),
      payload: JSON.parse(parsedToken.getPayload()),
      zkProof: parsedToken.zkProof,
    },
    credential, // the matching credential is not sent to verifier, but is returned to show in UI
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
