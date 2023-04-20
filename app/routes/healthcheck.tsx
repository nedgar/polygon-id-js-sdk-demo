// learn more: https://fly.io/docs/reference/configuration/#services-http_checks
import type { LoaderArgs } from "@remix-run/node";

import config from "~/config.server";
import { prisma } from "~/db.server";

export async function loader({ request }: LoaderArgs) {
  const host = request.headers.get("X-Forwarded-Host") ?? request.headers.get("host");

  console.log("healthcheck config:", config);
  console.log("healthcheck SESSION_SECRET:", process.env.SESSION_SECRET);

  try {
    const url = new URL("/", `http://${host}`);
    // if we can connect to the database and make a simple query
    // and make a HEAD request to ourselves, then we're good.
    const [numUsers] = await Promise.all([
      prisma.user.count(),
      fetch(url.toString(), { method: "HEAD" }).then((r) => {
        if (!r.ok) return Promise.reject(r);
      }),
    ]);
    console.log("healthcheck ✅", { numUsers });
    return new Response(["Status: OK", `Num users: ${numUsers}`].join("\n"));
  } catch (error: unknown) {
    console.log("healthcheck ❌", { error });
    return new Response("Status: ERROR", { status: 500 });
  }
}
