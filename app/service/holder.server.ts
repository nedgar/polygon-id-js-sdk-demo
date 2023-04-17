import {
  AuthorizationRequestMessage,
  AuthorizationResponseMessage,
  W3CCredential,
  ZKPRequestWithCredential
} from "@0xpolygonid/js-sdk";
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
    req: scope[0],
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
      "headers": JSON.parse(parsedToken.serializeHeaders()),
      "payload": JSON.parse(parsedToken.getPayload()),
      "zkProof": parsedToken.zkProof,
    },
    credential, // the matching credential is not sent to verifier, but is returned to show in UI
  };
}
