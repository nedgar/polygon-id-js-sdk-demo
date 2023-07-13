import { LoaderArgs, TypedResponse, json } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { AuthResponseDescription } from "~/components/auth-response";
import { ObjectGrid } from "~/components/object-grid";
import { Section } from "~/components/section";
import { ZKProofDescription } from "~/components/zk-proof";
import { Permission, getAvailablePermissions } from "~/service/permissions.server";

import { VerifierThreadState, getUserDIDs, getUserThreads } from "~/service/verifier.server";
import { boolToSymbol } from "~/shared/formatting";

interface VerifierUser {
  did: string;
}

interface LoaderData {
  availablePermissions: Permission[];
  users: VerifierUser[];
  did?: string | null;
  threads?: VerifierThreadState[];
  threadId?: string | null;
}

export const meta = () => [{ title: "Verifier - Polygon ID JS SDK Demo" }];

export const loader = async ({ request }: LoaderArgs): Promise<TypedResponse<LoaderData>> => {
  const searchParams = new URL(request.url).searchParams;
  const userDID = searchParams.get("did");
  const threadId = searchParams.get("thid");

  const userDIDs = getUserDIDs();
  return json({
    availablePermissions: getAvailablePermissions(),
    users: userDIDs.map((did) => ({
      did,
    })),
    did: userDID,
    threads: userDID ? getUserThreads(userDID) : undefined,
    threadId,
  });
};

export default function Verifier() {
  const { availablePermissions, users, did, threads, threadId } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const otherParams = new URLSearchParams(searchParams);
  otherParams.delete("did");
  otherParams.delete("thid");

  const thread =
    threads && threadId ? threads.find((t) => t.authRequest.thid === threadId) : undefined;

  return (
    <div className="px-4 py-4">
      <h1 className="mb-4 text-2xl font-bold">Polygon ID JS-SDK Demo – Verifier</h1>
      <Section title="Available Permissions">
        {availablePermissions.map(({id, name, challengeTypes}) => (
          <ObjectGrid key={id} obj={{
            name,
            challenges: challengeTypes.join(", "),
          }}/>))}
      </Section>
      <Section title="Users">
        <ul>
          {users.map((user) => (
            <li key={user.did}>
              <Link
                to={`?${otherParams.toString()}&did=${user.did}`}
                className="text-blue-600 underline"
              >
                {user.did}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Verification Threads">
        {did ? (
          <ul>
            {(threads ?? [])
              .sort((a, b) => (a.challengeType ?? "").localeCompare(b.challengeType ?? ""))
              .map((thread) => (
                <li id={thread.authRequest.thid}>
                  <Link
                    to={`?${otherParams.toString()}&did=${did}&thid=${thread.authRequest.thid}`}
                    className="text-blue-600 underline"
                  >
                    {thread.challengeType ?? "???"}
                  </Link>{" "}
                  {boolToSymbol(thread.verifierChecks?.authVerified)}
                 
                  {/* (thread: {thread.authRequest.thid})} */}
                </li>
              ))}
          </ul>
        ) : (
          <p>Select a user.</p>
        )}
      </Section>
      <Section title="Selected Thread">
        {thread ? (
          <Section title="Response">
            {thread?.authResponse ? (
              <>
                <AuthResponseDescription message={thread.authResponse} />
                {(thread.authResponse.body?.scope || []).map((proof, i) => (
                  <Section title={`Proof ${i+1}:`}>
                  <ZKProofDescription key={proof.id} proof={proof} />
                  </Section>
                ))}
              </>
            ) : (
              <p>Missing.</p>
            )}
          </Section>
        ) : (
          <p>Select a thread.</p>
        )}
      </Section>
    </div>
  );
}
