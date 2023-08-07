import type { W3CCredential } from "@0xpolygonid/js-sdk";
import type { ActionArgs, LoaderArgs, TypedResponse } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
} from "@remix-run/react";
import { useMemo } from "react";
import invariant from "tiny-invariant";

import { CredentialDescription } from "~/components/credential";
import { Section } from "~/components/section";
import type { KeyData } from "~/service/identity.server";
import {
  createIdentity,
  createKey,
  getAuthCredential,
  getDID,
  getKeyData,
  getSubjectCredentials,
} from "~/service/identity.server";
import { requestCredential } from "~/service/issuer.server";
import { requireUserId } from "~/session.server";
import { CredentialRequestType } from "~/shared/credential-request-type";
import { useOptionalNames } from "~/utils";

interface HolderLoaderData {
  keyData?: KeyData;
  authCredential?: W3CCredential;
  issuerDID?: string;
  subjectCredentials: Array<W3CCredential>;
}

interface HolderActionData {
  keyData?: KeyData;
  authCredential?: W3CCredential;
  issuedCredential?: W3CCredential;
  error?: string;
}

const HOLDER_ALIAS = "holder";

export const meta = () => [{ title: "Holder - Polygon ID JS SDK Demo" }];

export const loader = async ({ request }: LoaderArgs): Promise<TypedResponse<HolderLoaderData>> => {
  const userId = await requireUserId(request);
  const keyData = await getKeyData(userId, HOLDER_ALIAS);
  const authCredential = getAuthCredential(userId, HOLDER_ALIAS);
  const issuerDID = getDID(userId, "issuer");
  const subjectCredentials = await getSubjectCredentials(userId, HOLDER_ALIAS);
  return json({
    keyData,
    issuerDID: issuerDID?.string(),
    authCredential,
    subjectCredentials,
  });
};

export const action = async ({ request }: ActionArgs): Promise<TypedResponse<HolderActionData>> => {
  const userId = await requireUserId(request);

  // console.log("before action:", await getStats());
  const { _action, ...values } = Object.fromEntries(await request.formData());
  switch (_action) {
    case "newRandomKey":
      await createKey(userId, HOLDER_ALIAS);
      const keyData = await getKeyData(userId, HOLDER_ALIAS);
      invariant(keyData);

      // console.log("after action:", await getStats());
      return json({ keyData });
    case "createIdentity":
      await createIdentity(userId, HOLDER_ALIAS);
      const authCredential = getAuthCredential(userId, HOLDER_ALIAS);
      // console.log("after action:", await getStats());
      return json({ authCredential });
    case "requestCredential":
      if (!values.credentialType) {
        return json({ error: "Select a credential type" });
      }
      const isSupportedType = Object.values(CredentialRequestType).includes(
        values.credentialType as CredentialRequestType
      );
      if (!isSupportedType) {
        return json({ error: `Unsupported credential type: ${values.credentialType}` });
      }

      const credential = await requestCredential(
        userId,
        "issuer",
        HOLDER_ALIAS,
        values.credentialType as CredentialRequestType
      );
      // console.log("after action:", await getStats());
      return json({ issuedCredential: credential });
    default: {
      invariant(false, "Unexpected action");
    }
  }
};

const buttonClassName =
  "rounded bg-blue-500 px-2 py-1 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300 mb-1 ml-16";

export default function HolderPage() {
  const location = useLocation();
  const names = useOptionalNames();

  const { keyData, authCredential, issuerDID, subjectCredentials } = useLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>();
  if (actionData?.error) {
    console.error(`Error: ${actionData.error}`);
  }

  const navigation = useNavigation();
  const formAction = useMemo(() => navigation.formData?.get("_action"), [navigation.formData]);

  // useEffect(() => {
  //   console.log("navigation state changed:", navigation, "action:", formAction);
  // }, [navigation.state]);

  return (
    <div className="px-4 py-4">
      <h1 className="mb-4 text-2xl font-bold">
        Polygon ID JS-SDK Demo – Holder {names.holder && `(${names.holder})`}
      </h1>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Section title="1: Generate Holder Key" className="border">
            <Form method="post">
              <p>
                <label>Private Key in hex: </label>
                <button
                  type="submit"
                  name="_action"
                  value="newRandomKey"
                  className={buttonClassName}
                >
                  {formAction === "newRandomKey" ? "Generating key..." : "Generate Random Key"}
                </button>
                <textarea
                  className="w-full rounded border"
                  readOnly
                  value={keyData?.privateKey.hex}
                />
              </p>
              <p className="mt-2">
                <label>Public Key in hex:</label>
                <textarea
                  className="w-full rounded border"
                  readOnly
                  value={keyData?.publicKey.hex}
                />
              </p>
              <p className="mt-2">
                <label>Public Key BJJ coords:</label>
                <br />
                <label>X:</label>
                <textarea
                  readOnly
                  className="w-full rounded border"
                  value={keyData?.publicKey.p.x}
                />
                <label>Y:</label>
                <textarea
                  readOnly
                  className="w-full rounded border"
                  value={keyData?.publicKey.p.y}
                />
              </p>
            </Form>
          </Section>
          <Section title="2: Create Holder Identity" className="mt-4 border">
            <Form method="post">
              <input type="hidden" name="privateKey" value={keyData?.privateKey.hex ?? ""} />
              <p>
                <label>DID: </label>
                <button
                  className={buttonClassName}
                  disabled={!keyData}
                  name="_action"
                  type="submit"
                  value="createIdentity"
                >
                  {formAction === "createIdentity"
                    ? "Creating identity..."
                    : "Create Identity for Key"}
                </button>
              </p>
            </Form>
            <textarea
              className="w-full rounded border"
              readOnly
              value={authCredential?.issuer ?? ""}
            />

            <div className="mt-2">
              <label>Auth Credential:</label>
              <div className="border">
                {authCredential ? (
                  <CredentialDescription cred={authCredential as W3CCredential} />
                ) : (
                  "none"
                )}
              </div>
            </div>
          </Section>
        </div>
        <div>
          <Section
            title={
              <>
                3: Request Credentials from{" "}
                <Link
                  className="text-blue-500 underline"
                  to={{ pathname: "/issuer", search: location.search }}
                >
                  Issuer
                </Link>
              </>
            }
            className="border"
          >
            <p>Issuer DID: {issuerDID ?? "---"}</p>
            <Form className="mt-2" method="post">
              <label>Choose credential type: </label>
              <select
                className="border"
                name="credentialType"
                disabled={!authCredential || !issuerDID}
              >
                <option>--Please select an option--</option>
                <option value={CredentialRequestType.FIN_AUM_HIGH}>
                  Financial: Assets Under Management (high)
                </option>
                <option value={CredentialRequestType.FIN_AUM_LOW}>
                  Financial: Assets Under Management (low)
                </option>
                <option value={CredentialRequestType.FIN_BANK_ACCOUNT}>
                  Financial: Bank Account
                </option>
                <option value={CredentialRequestType.ID_PASSPORT}>ID: Passport</option>
                <option value={CredentialRequestType.KYC_AGE}>KYC: Age (date of birth)</option>
                <option value={CredentialRequestType.KYC_COUNTRY_OF_RESIDENCE}>
                  KYC: Country of Residence
                </option>
              </select>
              <button
                className={buttonClassName}
                disabled={!authCredential || !issuerDID}
                name="_action"
                type="submit"
                value="requestCredential"
              >
                {formAction === "requestCredential"
                  ? "Requesting credential..."
                  : "Request Credential"}
              </button>
            </Form>
          </Section>
          <Section title="Holder's Issued Credentials" className="mt-4 border">
            {subjectCredentials.length === 0 && "None"}
            {subjectCredentials.map((cred, i) => (
              <div key={i}>
                {i > 0 && <br />}
                <p>{i + 1}:</p>
                <div className="border">
                  <CredentialDescription cred={cred as W3CCredential} />
                </div>
                {/* <textarea
                  readOnly
                  className="w-full border"
                  rows={Math.max(15, 42 / subjectCredentials.length)}
                  value={credDesc}
                /> */}
              </div>
            ))}
          </Section>
          <Section title="4: Verify Credentials" className="mt-4 border">
            Click{" "}
            <Link
              className="text-blue-500 underline"
              to={{ pathname: "/verification", search: location.search }}
            >
              here
            </Link>{" "}
            to start a credential verification flow.
          </Section>
        </div>
      </div>
    </div>
  );
}
