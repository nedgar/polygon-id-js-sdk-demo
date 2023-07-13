import type {
  AuthorizationRequestMessage,
  AuthorizationResponseMessage,
  W3CCredential
} from "@0xpolygonid/js-sdk";
// import { ethers, AlchemyProvider } from "ethers";
import { ActionArgs, LoaderArgs, TypedResponse, json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
} from "@remix-run/react";
import { Fragment, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import invariant from "tiny-invariant";

import { AuthRequestDescription } from "~/components/auth-request";
import { AuthResponseDescription } from "~/components/auth-response";
import { CredentialDescription } from "~/components/credential";
import { ObjectGrid } from "~/components/object-grid";
import { Section } from "~/components/section";
import { ZKProofDescription } from "~/components/zk-proof";
import {
  clearHolderThreadState,
  generateAuthResponse,
  getHolderThreadState,
} from "~/service/holder.server";
import { findMatchingCredentials, getDID } from "~/service/identity.server";
import {
  VERIFIER_DID,
  VerifyAuthResponseChecks,
  VerifyAuthResponseResult,
  getAuthRequestMessage,
  getVerifierThreadState,
  verifyAuthResponse,
} from "~/service/verifier.server";
import { requireUserId } from "~/session.server";
import { ChallengeType } from "~/shared/challenge-type";
import { boolToSymbol } from "~/shared/formatting";
import { useOptionalNames } from "~/utils";
// import { UserTokenStatus, getUserTokenStatus, tokenContract } from "~/service/blockchain.server";

interface VerificationLoaderData {
  verifierDID: string;
  holderDID?: string;
  challengeType?: ChallengeType;
  authRequest?: AuthorizationRequestMessage;
  credential?: W3CCredential;
  authResponse?: AuthorizationResponseMessage;
  token?: string;
  tokenDecoded?: any;
  verifierChecks?: VerifyAuthResponseChecks;
}

interface VerificationActionData {
  challengeType?: string;
  matchingCredentials?: Array<W3CCredential>;
  authRequest?: AuthorizationRequestMessage;
  // credential?: W3CCredential;
  // authResponse?: AuthorizationResponseMessage;
  token?: string;
  verifyAuthResponseResult?: VerifyAuthResponseResult;
  // userTokenStatus?: UserTokenStatus;
  error?: string;
}

export const meta = () => [{ title: "Verification - Polygon ID JS SDK Demo" }];

export const loader = async ({
  request,
}: LoaderArgs): Promise<TypedResponse<VerificationLoaderData>> => {
  const userId = await requireUserId(request);

  const searchParams = new URL(request.url).searchParams;
  const threadId = searchParams.get("thid");
  console.log("threadId:", threadId);

  const holderThreadState = threadId ? getHolderThreadState(threadId) : undefined;
  const verifierThreadState = threadId ? getVerifierThreadState(threadId) : undefined;

  return json({
    verifierDID: VERIFIER_DID,
    holderDID: getDID(userId, "holder")?.toString(),
    challengeType: verifierThreadState?.challengeType,
    authRequest: verifierThreadState?.authRequest,
    credential: holderThreadState?.selectedCredential,
    authResponse: holderThreadState?.authResponse,
    token: holderThreadState?.token,
    tokenDecoded: holderThreadState?.tokenDecoded,
    verifierChecks: verifierThreadState?.verifierChecks,
  });
};

export const action = async ({
  request,
}: ActionArgs): Promise<TypedResponse<VerificationActionData>> => {
  const userId = await requireUserId(request);

  function presentChallenge(
    verifierDID?: string,
    challengeType?: ChallengeType
  ): VerificationActionData {
    invariant(verifierDID, "Missing verifier DID");
    if (!challengeType) {
      return { error: "Select a challenge type" };
    }
    if (!Object.values(ChallengeType).includes(challengeType)) {
      return { error: "Unsupported challenge type" };
    }

    const authRequest = getAuthRequestMessage(verifierDID, challengeType);

    return {
      challengeType,
      authRequest,
    };
  }

  async function scanChallengeQR(authRequestJson?: string): Promise<VerificationActionData> {
    invariant(typeof authRequestJson === "string", "missing auth request message");

    const authRequest = JSON.parse(authRequestJson) as AuthorizationRequestMessage;
    if (authRequest.thid) {
      clearHolderThreadState(authRequest.thid);
    }

    const matchingCredentials = await findMatchingCredentials(userId, "holder", authRequest);

    return {
      matchingCredentials,
    };
  }

  async function generateProof(
    userDID: string,
    authRequestJson: string,
    credentialId: string
  ): Promise<VerificationActionData> {
    invariant(typeof userDID === "string", "missing user DID");
    invariant(typeof authRequestJson === "string", "missing auth request");
    invariant(typeof credentialId === "string", "missing credential ID");

    const authRequestIn = JSON.parse(authRequestJson);
    return await generateAuthResponse(userDID, authRequestIn, credentialId);
  }

  async function handleAuthResponse(authToken: string): Promise<VerificationActionData> {
    console.log("authToken:", authToken);
    invariant(typeof authToken === "string", "missing auth token");

    const result = await verifyAuthResponse(authToken);

    return {
      token: authToken,
      verifyAuthResponseResult: result,
    };
  }

  const { _action, ...values } = Object.fromEntries(await request.formData());
  const t = Date.now();
  try {
    let data: VerificationActionData;
    switch (_action) {
      case "presentChallenge":
        data = presentChallenge(
          values.verifierDID as string,
          values.challengeType as ChallengeType
        );
        return redirect(`?thid=${data.authRequest?.thid}`);
      case "scanChallengeQR":
        data = await scanChallengeQR(values.authRequest as string);
        break;
      case "generateProof":
        data = await generateProof(
          values.holderDID as string,
          values.authRequest as string,
          values.credentialId as string
        );
        break;
      case "handleAuthResponse":
        data = await handleAuthResponse(values.authToken as string);
        break;
      // case "checkProofStatus":
      //   data = {
      //     userTokenStatus: await getUserTokenStatus(values.address as string),
      //   };
      //   break;
      default: {
        invariant(false, `Unexpected action: ${_action}`);
      }
    }
    console.log(`response data for action ${_action}:`, JSON.stringify(data, null, 2));
    return json(data);
  } catch (err) {
    console.error("Error in action processing:", err);
    return json({
      error: String(err),
    });
  } finally {
    console.log(`${_action} action took ${Date.now() - t} ms`);
  }
};

const buttonClassName =
  "rounded bg-blue-500 px-2 py-1 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300";

function AuthResponseVerification({ checks, errors }: VerifyAuthResponseResult) {
  return (
    <>
      <div>Decoded payload: (see Auth Response Message at right).</div>
      <div>
        {errors.length === 0 ? "✅ Everything checks out!" : "❌ One or more checks failed."}
      </div>
      <div className="mt-2">
        <p>Checks:</p>
        <ul className="ml-4 list-inside list-disc">
          <li>JWZ token syntax is valid: {boolToSymbol(checks.tokenSyntax)}</li>
          <li>response media type is Iden3 ZKP: {boolToSymbol(checks.mediaType)}</li>
          <li>payload signature is valid (signed by user, no tampering)</li>
          <li>a matching request exists (same ID and schema): {boolToSymbol(checks.requestExists)}</li>
          <li>ZKP of credential claim is satisfied: {boolToSymbol(checks.authVerified)}</li>
          <ul className="ml-4 list-inside list-disc">
            <li>user is the claim's subject</li>
            <li>claim schema matches request</li>
            <li>claim has not expired</li>
            <li>issuer's auth claim is valid:</li>
            <ul className="ml-4 list-inside list-disc">
              <li>auth claim schema is Iden3 AuthV2</li>
              <li>auth claim exists and has not been revoked from issuer's ID state (MTP)</li>
              <li>(issuer's public key is extracted from auth claim)</li>
            </ul>
            <li>claim signature is valid (claim signed by issuer, no tampering)</li>
            <li>claim exists and has not been revoked from issuer's ID state</li>
            <li>queried property exists in credential (MTP)</li>
            <li>query is satisfied by property value</li>
          </ul>
        </ul>
      </div>
      <div className="mt-2">
        Errors:{" "}
        {errors.length === 0 ? (
          "none"
        ) : (
          <ol className="ml-4 list-inside list-decimal">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

// function OnChainStatus({ userTokenStatus }: { userTokenStatus?: UserTokenStatus }) {
//   return (
//     <Form method="post">
//       <label>Address:</label>{" "}
//       <input
//         type="text"
//         className="rounded border"
//         defaultValue="0x59c8c433344a65dD22fBDe54Cfa5d440954512Fa"
//         name="address"
//         pattern="0x[0-9A-Fa-f]{40}"
//         required
//         size={50}
//       />
//       <input type="hidden" name="requestId" value={1} />
//       <br />
//       <button
//         className={buttonClassName + " mt-2"}
//         name="_action"
//         type="submit"
//         value="checkProofStatus"
//       >
//         Check Proof Status
//       </button>
//       {userTokenStatus && (
//         <div className="mt-2">
//           <p>Address: {userTokenStatus.address}</p>
//           <p>Request IDs with proof: {userTokenStatus.requestsWithProof.join(", ") || "<none>"}</p>
//           <p>Assigned roles: {userTokenStatus.roles.join(", ") || "<none>"}</p>
//         </div>
//       )}
//     </Form>
//   );
// }

export default function VerificationPage() {
  const location = useLocation();
  const names = useOptionalNames();

  const {
    challengeType,
    holderDID,
    verifierDID,
    authRequest,
    credential,
    authResponse,
    token,
    tokenDecoded,
    verifierChecks,
  } = useLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>();

  const navigation = useNavigation();
  const formAction = navigation.formData?.get("_action");

  useEffect(() => {
    // console.log("actionData:", actionData);
    if (actionData?.error) {
      console.error("Error in action data:", actionData?.error);
    }
  }, [actionData]);

  useEffect(() => {
    console.log("formAction:", formAction);
  }, [formAction]);

  const proofVerificationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    console.log("actionData.verifyAuthResponseResult:", actionData?.verifyAuthResponseResult);
    console.log("proofVerificationRef:", proofVerificationRef);
    if (formAction === "handleAuthResponse" && actionData?.verifyAuthResponseResult) {
      proofVerificationRef.current?.scrollIntoView();
    }
  }, [formAction, actionData?.verifyAuthResponseResult, proofVerificationRef.current]);

  const zkpResponses = authResponse?.body?.scope ?? [];

  return (
    <div className="px-4 py-4">
      <h1 className="mb-4 text-2xl font-bold">Polygon ID JS-SDK Demo – Verification</h1>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Section
            title={<>Verifier Identity {names.verifier && `(${names.verifier})`}</>}
            className="border"
          >
            <p>
              <label>DID:</label>
              <textarea className="w-full rounded border" readOnly value={verifierDID} />
            </p>
          </Section>
          <Section title="1: Verifier Presents Authorization Request" className="mt-4 border">
            <Form className="mt-2" method="post">
              <label>Choose request type: </label>
              <select className="border" defaultValue={challengeType} name="challengeType" required>
                <option value="" aria-required="false">
                  --Select an option--
                </option>
                <option value={ChallengeType.FIN_DISCLOSE_BANK_ACCOUNT}>
                  FIN: Disclose bank account (1 ZKP with VP)
                </option>
                <option value={ChallengeType.FIN_AUM_OVER_THRESHOLD}>
                  FIN: Total assets under management over threshold (2 ZKPs)
                </option>
                <option value={ChallengeType.ID_PASSPORT_MATCHES}>
                  ID: Passport number matches and country is OK (2 ZKPs)
                </option>
                <option value={ChallengeType.KYC_COUNTRY_NOT_SANCTIONED}>
                  KYC: Country of residence is not sanctioned (1 ZKP)
                </option>
                <option value={ChallengeType.KYC_DISCLOSE_BIRTHDAY}>
                  KYC: Disclose birthday (1 ZKP with VP)
                </option>
                <option value={ChallengeType.KYC_USER_IS_ADULT}>
                  KYC: User is an adult, at least 21 years old (1 ZKP)
                </option>
              </select>
              <input type="hidden" name="verifierDID" value={verifierDID} />
              <br />
              <button
                className={buttonClassName + " mt-2"}
                disabled={!verifierDID}
                name="_action"
                type="submit"
                value="presentChallenge"
              >
                {formAction === "presentChallenge"
                  ? "Presenting auth request..."
                  : "Present Auth Request"}
              </button>
            </Form>
            {authRequest && (
              <>
                <br />
                <p>Auth request message:</p>
                <div className="border">
                  <AuthRequestDescription message={authRequest} />
                </div>
                <br />
                <p>As QR code:</p>
                <QRCode value={JSON.stringify(authRequest)} size={300} />
              </>
            )}
          </Section>
          <Section
            title="5: Verifier Receives JWZ and Verifies Proof"
            className="mt-4 border"
            ref={proofVerificationRef}
          >
            {verifierChecks && (
              <AuthResponseVerification
                checks={verifierChecks}
                errors={actionData?.verifyAuthResponseResult?.errors ?? []}
              />
            )}
          </Section>
        </div>
        <div>
          <Section
            className="border"
            title={
              <>
                <Link
                  className="text-blue-500 underline"
                  to={{ pathname: "/holder", search: location.search }}
                >
                  Holder
                </Link>{" "}
                Identity {names.holder && `(${names.holder})`}
              </>
            }
          >
            <p>
              <label>DID:</label>
              <textarea className="w-full rounded border" readOnly value={holderDID} />
            </p>
          </Section>
          <Section title="2: Holder Scans Authorization Request" className="mt-4 border">
            <Form className="mt-2" method="post">
              <label>Click to scan QR code: </label>
              {authRequest && (
                <input type="hidden" name="authRequest" value={JSON.stringify(authRequest)} />
              )}
              <button
                className={buttonClassName}
                disabled={!holderDID || !authRequest}
                name="_action"
                type="submit"
                value="scanChallengeQR"
              >
                {formAction === "scanChallengeQR" ? "Scanning QR code..." : "Scan QR Code"}
              </button>
            </Form>
          </Section>
          <Section
            title="3: Holder Selects Matching Credential and Generates Proof"
            className="mt-4 border"
          >
            {Array.isArray(actionData?.matchingCredentials) && (
              <Form method="post">
                {actionData?.matchingCredentials?.length === 0 ? (
                  <p>No matching credentials found.</p>
                ) : (
                  <>
                    <p>Select a matching credential:</p>
                    {actionData?.matchingCredentials.map((cred, i) => (
                      <div key={cred.id} className="mt-2">
                        <input
                          type="radio"
                          className="mr-2"
                          id={`credential-${cred.id}`}
                          name="credentialId"
                          defaultChecked={i === 0}
                          value={cred.id}
                        />
                        <label htmlFor={`credential-${cred.id}`}>{i + 1}:</label>
                        <div className="border">
                          <CredentialDescription key={cred.id} cred={cred as W3CCredential} />
                        </div>
                      </div>
                    ))}
                    <button
                      className={buttonClassName + " mt-4"}
                      disabled={!holderDID || !authRequest}
                      name="_action"
                      type="submit"
                      value="generateProof"
                    >
                      {formAction === "generateProof"
                        ? "Generating proof (this can take a while)..."
                        : "Generate Proof(s)"}
                    </button>
                    {holderDID && <input type="hidden" name="holderDID" value={holderDID} />}
                    {authRequest && (
                      <input type="hidden" name="authRequest" value={JSON.stringify(authRequest)} />
                    )}
                  </>
                )}
              </Form>
            )}
            {credential && (
              <>
                <p>Selected credential:</p>
                <div className="border">
                  <CredentialDescription cred={credential as W3CCredential} />
                </div>
              </>
            )}
            {authResponse && (
              <>
                {zkpResponses.map((zkpResp, i) => (
                  <Fragment key={i}>
                    <br />
                    <p>ZK Proof Response{zkpResponses.length > 1 ? ` ${i + 1}` : ""}:</p>
                    <div className="border" key={i}>
                      <ZKProofDescription proof={zkpResp} />
                    </div>
                  </Fragment>
                ))}
                <br />
                <p>Auth Response Message:</p>
                <div className="border">
                  <AuthResponseDescription message={authResponse} />
                </div>
              </>
            )}
          </Section>
          <Section title="4: Holder Sends Response as JWZ Token" className="mt-4 border">
            {token && tokenDecoded && (
              <>
                <p>
                  A JWZ token is a kind of JWT (JSON Web Token) containing three parts, in base-64
                  encoded JSON: headers, payload, and signature proof.
                </p>
                <br />
                <p>JWZ headers:</p>
                <div className="border">
                  <ObjectGrid obj={tokenDecoded.headers} />
                </div>
                <br />
                <p>JWZ payload: (see Auth Response message above)</p>
                <br />
                <p>JWZ proof:</p>
                <div className="mb-4 border">
                  <ZKProofDescription
                    circuitId={tokenDecoded.headers?.circuitId}
                    proof={tokenDecoded.zkProof}
                  />
                </div>
                <Form method="post">
                  <input type="hidden" name="authToken" value={token} />
                  <button
                    className={buttonClassName}
                    name="_action"
                    type="submit"
                    value="handleAuthResponse"
                  >
                    {formAction === "handleAuthResponse"
                      ? "Sending response..."
                      : "Send Response as JWZ"}
                  </button>
                </Form>
              </>
            )}
          </Section>
          {/* <Section title="On-Chain Status" className="mt-4 border">
            <OnChainStatus userTokenStatus={actionData?.userTokenStatus} />
          </Section> */}
        </div>
      </div>
    </div>
  );
}
