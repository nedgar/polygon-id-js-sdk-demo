import type { LoaderArgs, TypedResponse } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { Section } from "~/components/section";
import type { VerifierThreadState } from "~/service/verifier.server";
import { getUserThreads } from "~/service/verifier.server";

interface LoaderData {
  did: string
  threads: VerifierThreadState[];
}

// export const meta = () => [{ title: "Verifier - Polygon ID JS SDK Demo" }];

export const loader = async ({ request, params }: LoaderArgs): Promise<TypedResponse<LoaderData>> => {
  const { did } = params;
  invariant(did, "Missing DID");
  invariant(did?.startsWith("did:"), `Not a DID: ${did}`);

  return json({
    did,
    threads: getUserThreads(did),
  });
};

export default function VerifierUsers() {
  const { did, threads } = useLoaderData<typeof loader>();

  return (
    <Section title="Verification Threads">
      <p>User DID: {did}</p>
      <p>Threads:</p>
      <ul>
        {threads.map((thread) => (
          <li key={thread.authRequest.thid}>{thread.authRequest.thid}: (type: {thread.challengeType})</li>
        ))}
      </ul>
    </Section>
  );
}
