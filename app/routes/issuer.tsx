import type { W3CCredential } from "@0xpolygonid/js-sdk";
import type { ActionArgs, LoaderArgs, TypedResponse } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useLoaderData, useLocation, useNavigation } from "@remix-run/react";
import { useMemo } from "react";
import invariant from "tiny-invariant";
import { CredentialDescription } from "~/components/credential";
import { Section } from "~/components/section";

import type { KeyData } from "~/service/identity.server";
import {
  createKey,
  getKeyData,
  getAuthCredential,
  getIssuedCredentials,
} from "~/service/identity.server";
import { createIdentity } from "~/service/identity.server";
import { requireUserId } from "~/session.server";
import { useOptionalNames } from "~/utils";

interface IssuerData {
  keyData?: KeyData;
  authCredential?: W3CCredential;
  issuedCredentials?: Array<W3CCredential>;
}

const ISSUER_ALIAS = "issuer";

export const meta = () => [{ title: "Issuer - Polygon ID JS SDK Demo" }];

export const loader = async ({
  request,
  params,
}: LoaderArgs): Promise<TypedResponse<IssuerData>> => {
  console.log("params:", params);
  const userId = await requireUserId(request);
  const keyData = await getKeyData(userId, ISSUER_ALIAS);
  const authCredential = getAuthCredential(userId, ISSUER_ALIAS);
  const issuedCredentials = await getIssuedCredentials(userId, ISSUER_ALIAS);
  return json({
    keyData,
    authCredential,
    issuedCredentials,
  });
};

export const action = async ({
  request,
  params,
}: ActionArgs): Promise<TypedResponse<IssuerData>> => {
  console.log("params:", params);
  const userId = await requireUserId(request);

  // console.log("before action:", await getStats());
  const { _action } = Object.fromEntries(await request.formData());
  switch (_action) {
    case "newRandomKey":
      await createKey(userId, ISSUER_ALIAS);
      const keyData = await getKeyData(userId, ISSUER_ALIAS);
      invariant(keyData);

      // console.log("after action:", await getStats());
      return json({ keyData });
    case "createIdentity":
      await createIdentity(userId, ISSUER_ALIAS);
      const authCredential = getAuthCredential(userId, ISSUER_ALIAS);
      // console.log("after action:", await getStats());
      return json({ authCredential });
    default: {
      invariant(false, "Unexpected action");
    }
  }
};

const buttonClassName =
  "rounded bg-blue-500 px-2 py-1 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300 mb-1 ml-16";

export default function IssuerPage() {
  const location = useLocation();
  const names = useOptionalNames();

  const { keyData, authCredential, issuedCredentials } = useLoaderData<typeof loader>();

  const navigation = useNavigation();
  const formAction = useMemo(
    () => String(navigation.formData?.get("_action")),
    [navigation.formData]
  );

  return (
    <div className="px-4 py-4">
      <h1 className="mb-4 text-2xl font-bold">
        Polygon ID JS-SDK Demo – Issuer {names.issuer && `(${names.issuer})`}
      </h1>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Section title="1: Generate Issuer Key" className="border">
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
          <Section title="2: Create Issuer Identity" className="mt-4 border">
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
                <textarea
                  className="w-full rounded border"
                  readOnly
                  value={authCredential?.issuer ?? ""}
                />
              </p>
            </Form>
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
            className="border"
            title={
              <>
                Issued Credentials (
                <Link
                  className="text-blue-500 underline"
                  to={{ pathname: "/holder", search: location.search }}
                >
                  Holder
                </Link>{" "}
                must request)
              </>
            }
          >
            {issuedCredentials?.map((cred, i) => (
              <div key={i}>
                {i > 0 && <br />}
                <p>{i + 1}:</p>
                <div className="border">
                  <CredentialDescription cred={cred as W3CCredential} />
                </div>
              </div>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}
