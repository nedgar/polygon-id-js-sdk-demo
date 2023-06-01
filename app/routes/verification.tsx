import type {
  AuthorizationRequestMessage,
  AuthorizationResponseMessage,
  W3CCredential,
} from "@0xpolygonid/js-sdk";
import { ethers, AlchemyProvider } from "ethers";
import type { ActionArgs, LoaderArgs, TypedResponse } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Fragment, useEffect, useMemo } from "react";
import QRCode from "react-qr-code";
import invariant from "tiny-invariant";

import { AuthRequestDescription } from "~/components/auth-request";
import { AuthResponseDescription } from "~/components/auth-response";
import { CredentialDescription } from "~/components/credential";
import { ObjectGrid } from "~/components/object-grid";
import { Section } from "~/components/section";
import { ZKProofDescription } from "~/components/zk-proof";
import { generateAuthResponse } from "~/service/holder.server";
import { findMatchingCredentials, getDID } from "~/service/identity.server";
import {
  VerifyAuthResponseResult,
  getAuthRequestMessage,
  verifyAuthResponse,
} from "~/service/verifier.server";
import { requireUserId } from "~/session.server";
import { ChallengeType } from "~/shared/challenge-type";
import { UserTokenStatus, getUserTokenStatus, tokenContract } from "~/service/blockchain.server";

interface VerificationLoaderData {
  holderDID?: string;
  verifierDID?: string;
  verifyAuthResponseResult?: VerifyAuthResponseResult;
}

interface VerificationActionData {
  challengeType?: string;
  authRequest?: AuthorizationRequestMessage;
  matchingCredentials?: Array<W3CCredential>;
  credential?: W3CCredential;
  authResponse?: AuthorizationResponseMessage;
  token?: string;
  tokenDecoded?: any;
  verifyAuthResponseResult?: VerifyAuthResponseResult;
  userTokenStatus?: UserTokenStatus;
  error?: string;
}

const VERIFIER_DID = "did:polygonid:polygon:mumbai:2qMFtSnvRGKFDVY5MawZENXv6eAQnGgKTNwid1wJoG";

export const meta = () => [{ title: "Verification - Polygon ID JS SDK Demo" }];

export const loader = async ({
  request,
}: LoaderArgs): Promise<TypedResponse<VerificationLoaderData>> => {
  const userId = await requireUserId(request);

  return json({
    holderDID: getDID(userId, "holder")?.toString(),
    verifierDID: VERIFIER_DID.toString(),
    // verifyAuthResponseResult: {
    //   checks: {
    //     tokenSyntax: true,
    //     mediaTypeOk: false,
    //     requestExists: undefined,
    //   },
    //   errors: [],
    // },
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

    const authRequest = JSON.parse(authRequestJson);
    const matchingCredentials = await findMatchingCredentials(userId, "holder", authRequest);

    return {
      authRequest,
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
        break;
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
      case "checkProofStatus":
        data = {
          userTokenStatus: await getUserTokenStatus(values.address as string),
        };
        break;
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

function AuthResponseVerification({ result }: { result: VerifyAuthResponseResult }) {
  const symbol = (val?: boolean) => (val ? "✅" : val === false ? "❌" : "❓");
  const { checks = {}, errors = [] } = result;

  return (
    <>
      <div>
        {errors.length === 0 ? "✅ Everything checks out!" : "❌ One or more checks failed."}
      </div>
      <div className="mt-2">
        <p>Checks:</p>
        <ul className="ml-4 list-inside list-disc">
          <li>token syntax: {symbol(checks.tokenSyntax)}</li>
          <li>media type is iden3 ZKP: {symbol(checks.mediaType)}</li>
          <li>has matching request: {symbol(checks.requestExists)}</li>
          <li>auth query satisfied: {symbol(checks.authVerified)}</li>
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

function OnChainStatus({ userTokenStatus }: { userTokenStatus?: UserTokenStatus }) {
  return (
    <Form method="post">
      <label>Address:</label>{" "}
      <input
        type="text"
        className="rounded border"
        defaultValue="0x59c8c433344a65dD22fBDe54Cfa5d440954512Fa"
        name="address"
        pattern="0x[0-9A-Fa-f]{40}"
        required
        size={50}
      />
      <input type="hidden" name="requestId" value={1} />
      <br />
      <button
        className={buttonClassName + " mt-2"}
        name="_action"
        type="submit"
        value="checkProofStatus"
      >
        Check Proof Status
      </button>
      {userTokenStatus && (
        <div className="mt-2">
          {/* <p>Address: {userTokenStatus.address}</p> */}
          <p>Request IDs with proof: {userTokenStatus.requestsWithProof.join(", ") || "<none>"}</p>
          <p>Assigned roles: {userTokenStatus.roles.join(", ") || "<none>"}</p>
        </div>
      )}
    </Form>
  );
}

export default function VerificationPage() {
  const { holderDID, verifierDID, verifyAuthResponseResult } = useLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>();
  useEffect(() => {
    if (actionData?.error) {
      console.error(`Error in action data: ${actionData.error}`);
    }
  }, [actionData]);

  const navigation = useNavigation();
  const formAction = navigation.formData?.get("_action");

  const zkpResponses = actionData?.authResponse?.body?.scope ?? [];

  return (
    <div className="px-4 py-4">
      <h1 className="mb-4 text-2xl font-bold">Polygon ID JS-SDK Demo – Verification</h1>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Section title="Verifier Identity" className="border">
            <p>
              <label>DID:</label>
              <textarea className="w-full rounded border" readOnly value={verifierDID} />
            </p>
          </Section>
          <Section title="1: Verifier Presents Authorization Request" className="mt-4 border">
            <Form className="mt-2" method="post">
              <label>Choose request type: </label>
              <select
                className="border"
                name="challengeType"
                value={actionData?.challengeType}
                required
              >
                <option value="" aria-required="false">
                  --Select an option--
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
                  KYC: Disclose birthday (1 ZKP + VP)
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
            {actionData?.authRequest && (
              <>
                <br />
                <p>Auth request message:</p>
                <div className="border">
                  <AuthRequestDescription message={actionData.authRequest} />
                </div>
                <br />
                <p>As QR code:</p>
                <QRCode value={JSON.stringify(actionData.authRequest)} size={300} />
              </>
            )}
          </Section>
          <Section title="5: Verifier Receives JWZ and Verifies Proof" className="mt-4 border">
            {actionData?.verifyAuthResponseResult && (
              <AuthResponseVerification result={actionData.verifyAuthResponseResult} />
            )}
          </Section>
        </div>
        <div>
          <Section
            className="border"
            title={
              <>
                <Link className="text-blue-500 underline" to="/holder">
                  Holder
                </Link>{" "}
                Identity
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
              {actionData?.authRequest && (
                <input
                  type="hidden"
                  name="authRequest"
                  value={JSON.stringify(actionData.authRequest)}
                />
              )}
              <button
                className={buttonClassName}
                disabled={!holderDID || !actionData?.authRequest}
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
                      disabled={!holderDID || !actionData?.authRequest}
                      name="_action"
                      type="submit"
                      value="generateProof"
                    >
                      {formAction === "generateProof"
                        ? "Generating proof (this can take a while)..."
                        : "Generate Proof"}
                    </button>
                    {holderDID && <input type="hidden" name="holderDID" value={holderDID} />}
                    {actionData?.authRequest && (
                      <input
                        type="hidden"
                        name="authRequest"
                        value={JSON.stringify(actionData.authRequest)}
                      />
                    )}
                  </>
                )}
              </Form>
            )}
            {actionData?.credential && (
              <>
                <p>Selected credential:</p>
                <div className="border">
                  <CredentialDescription cred={actionData.credential as W3CCredential} />
                </div>
              </>
            )}
            {actionData?.authResponse && (
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
                  <AuthResponseDescription message={actionData.authResponse} />
                </div>
              </>
            )}
          </Section>
          <Section title="4: Holder Sends Response as JWZ Token" className="mt-4 border">
            {actionData?.token && actionData?.tokenDecoded && (
              <>
                <p>
                  A JWZ token is a kind of JWT (JSON Web Token) containing three parts, in base-64
                  encoded JSON: headers, payload, and signature proof.
                </p>
                <br />
                <p>JWZ headers:</p>
                <div className="border">
                  <ObjectGrid obj={actionData.tokenDecoded.headers} />
                </div>
                <br />
                <p>JWZ payload: (see Auth Response message above)</p>
                <br />
                <p>JWZ proof:</p>
                <div className="mb-4 border">
                  <ZKProofDescription
                    circuitId={actionData.tokenDecoded.headers?.circuitId}
                    proof={actionData.tokenDecoded.zkProof}
                  />
                </div>
                <Form method="post">
                  <input type="hidden" name="authToken" value={actionData.token} />
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
