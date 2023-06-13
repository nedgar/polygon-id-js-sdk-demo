import { Response } from "@remix-run/node";
import { LoaderArgs } from "@remix-run/server-runtime";
import * as os from "os";

export async function loader({ request }: LoaderArgs) {
  const diagnostics = {
    cpus: os.cpus(),
  };
  return new Response(JSON.stringify(diagnostics, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
