import { LoaderArgs, TypedResponse, json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Section } from "~/components/section";

import { VerifierThreadState, getUserDIDs, getUserThreads } from "~/service/verifier.server";

interface VerifierUser {
  did: string;
  threads: VerifierThreadState[];
}

interface LoaderData {
  users: VerifierUser[];
}

export const loader = async ({ request }: LoaderArgs): Promise<TypedResponse<LoaderData>> => {
  const userDIDs = getUserDIDs();
  return json({
    users: userDIDs.map((did) => ({
      did,
      threads: getUserThreads(did),
    })),
  });
};

export default function VerifierUsers() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <Section title="Users">
      <ul>
        {users.map((user) => (
          <li key={user.did}>
            <Link to={`users/${user.did}`}>{user.did}</Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
