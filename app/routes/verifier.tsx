import type { LoaderArgs, TypedResponse } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { AuthResponseDescription } from "~/components/auth-response";
import { ObjectGrid } from "~/components/object-grid";
import { Section } from "~/components/section";
import { ZKProofDescription } from "~/components/zk-proof";
import type { UserPermission } from "~/service/permissions.server";
import { getUserPermissionsForChallengeType } from "~/service/permissions.server";
import type { VerifierThreadState } from "~/service/verifier.server";
import { getUserDIDs, getUserThreads } from "~/service/verifier.server";
import { boolToSymbol } from "~/shared/formatting";

interface VerifierUser {
  did: string;
}

interface LoaderData {
  users: VerifierUser[];
  did?: string | null;
  threads: VerifierThreadState[];
  threadId?: string | null;
  userPermissions: UserPermission[];
}

export const meta = () => [{ title: "Verifier - Polygon ID JS SDK Demo" }];

export const loader = async ({ request }: LoaderArgs): Promise<TypedResponse<LoaderData>> => {
  const searchParams = new URL(request.url).searchParams;
  const userDID = searchParams.get("did");
  const threadId = searchParams.get("thid");

  const userDIDs = getUserDIDs();

  const threads = userDID ? getUserThreads(userDID) : [];
  const thread = threadId ? threads.find(t => t.authRequest.thid === threadId) : undefined;

  return json({
    users: userDIDs.map((did) => ({
      did,
    })),
    did: userDID,
    threads,
    threadId: thread?.authRequest.thid,
    userPermissions: thread ? getUserPermissionsForChallengeType(thread.challengeType) : [],
  });
};

export default function Verifier() {
  const { users, did, threads, threadId, userPermissions } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const otherParams = new URLSearchParams(searchParams);
  otherParams.delete("did");
  otherParams.delete("thid");

  const thread =
    threads && threadId ? threads.find((t) => t.authRequest.thid === threadId) : undefined;

  return (
    <div className="px-4 py-4">
      <h1 className="mb-4 text-2xl font-bold">Polygon ID JS-SDK Demo – Verifier</h1>
      {/* <Section title="Available Permissions">
        {availablePermissions.map(({id, name, challengeTypes}) => (
          <ObjectGrid key={id} obj={{
            name,
            challenges: challengeTypes.join(", "),
          }}/>))}
      </Section> */}
      <Section title="Users">
        {users.length > 0 ? (
          <ul>
            {users.map((user, i) => (
              <li key={user.did}>
                {i + 1}:{" "}
                <Link
                  to={`?${otherParams.toString()}&did=${user.did}`}
                  className="text-blue-600 underline"
                >
                  {user.did}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No users with verified thread responses.</p>
        )}
      </Section>
      <Section title="Verification Threads for User">
        {did ? (
          <ul>
            {(threads ?? [])
              .sort((a, b) => (a.challengeType ?? "").localeCompare(b.challengeType ?? ""))
              .map((thread, i) => (
                <li key={thread.authRequest.thid}>
                  {i + 1}:{" "}
                  <Link
                    to={`?${otherParams.toString()}&did=${did}&thid=${thread.authRequest.thid}`}
                    className="text-blue-600 underline"
                  >
                    {thread.authRequest.thid}
                  </Link>
                  {" "}
                  ({thread.challengeType ?? "???"})
                  {" "}
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
        {!thread && (
          <p>Select a thread.</p>
        )}
        {thread && (<>
          <Section title="Response">
            {thread.authResponse ? (
              <>
                <AuthResponseDescription message={thread.authResponse} />
                {(thread.authResponse.body?.scope || []).map((proof, i, arr) => (
                  <Section key={i} title={`Proof ${i + 1} of ${arr.length}:`}>
                    <ZKProofDescription key={proof.id} proof={proof} />
                  </Section>
                ))}
              </>
            ) : (
              <p>Missing.</p>
            )}
          </Section>
          <Section title="Related Permissions">
            {userPermissions.length > 0 ? (
              <ul>
                {userPermissions.map(({permission, granted}, i) => (
                  <li className="mb-2">{i + 1}:
                    <ObjectGrid key={permission.id} obj={{
                      name: permission.name,
                      challengeType: permission.challengeType,
                      status: granted ? "Granted" : "Pending"
                    }} />
                  </li>))}
              </ul>
            ) : (
              <p>No available permissions.</p>
            )}
          </Section>
        </>)}
      </Section>
    </div>
  );
}
