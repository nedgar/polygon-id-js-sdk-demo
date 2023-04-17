import type { W3CCredential } from "@0xpolygonid/js-sdk";
import type { ActionArgs, LoaderArgs, TypedResponse } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { CredentialDescription } from "~/components/credential";
import { Section } from "~/components/section";

import {
  KeyData,
  createKey,
  getKeyData,
  getAuthCredential,
  getStats,
  getIssuedCredentials,
} from "~/service/identity.server";
import { createIdentity } from "~/service/identity.server";
import { requireUserId } from "~/session.server";

interface IssuerData {
  keyData?: KeyData;
  authCredential?: W3CCredential;
  issuedCredentials?: Array<W3CCredential>;
}

const ISSUER_ALIAS = "issuer";

export const loader = async ({ request }: LoaderArgs): Promise<TypedResponse<IssuerData>> => {
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

export const action = async ({ request }: ActionArgs): Promise<TypedResponse<IssuerData>> => {
  const userId = await requireUserId(request);

  console.log("before action:", await getStats());
  const { _action, ...values } = Object.fromEntries(await request.formData());
  switch (_action) {
    case "newRandomKey":
      await createKey(userId, ISSUER_ALIAS);
      const keyData = await getKeyData(userId, ISSUER_ALIAS);
      invariant(keyData);

      console.log("after action:", await getStats());
      return json({ keyData });
    case "createIdentity":
      await createIdentity(userId, ISSUER_ALIAS);
      const authCredential = getAuthCredential(userId, ISSUER_ALIAS);
      console.log("after action:", await getStats());
      return json({ authCredential });
    default: {
      invariant(false, "Unexpected action");
    }
  }
};

const buttonClassName =
  "rounded bg-blue-500 px-2 py-1 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300 mb-1 ml-16";

export default function IssuerPage() {
  const { keyData, authCredential, issuedCredentials } = useLoaderData<typeof loader>();

  return (
    <div className="px-4 py-4">
      <h1 className="mb-4 text-2xl font-bold">Polygon ID JS-SDK Demo – Issuer</h1>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Section title="Issuer Key Generation" className="border">
            <Form method="post">
              <p>
                <label>Private Key in hex: </label>
                <button
                  type="submit"
                  name="_action"
                  value="newRandomKey"
                  className={buttonClassName}
                >
                  Generate Random Key
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
          <Section title="Issuer Identity" className="mt-4 border">
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
                  Create Identity for Key
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
                Issued Credentials (see{" "}
                <Link className="text-blue-500 underline" to="/holder">
                  Holder
                </Link>
                )
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
