import type { AuthorizationRequestMessage, JSONObject } from "@0xpolygonid/js-sdk";
import { ObjectGrid } from "./object-grid";

interface Props {
  message: AuthorizationRequestMessage;
}

// function parseQuery(query: any) {
//   if (query) {
//     const qe = Object.entries(query);
//     if (qe.length === 1) {
//       const field = qe[0][0];
//       const comparison = qe[0][1];
//       const ce = Object.entries(comparison);
//       if (ce.length === 1) {
//         const op = ce[0];
//       }
//     }
//   }
// }

export function AuthRequestDescription({ message }: Props) {
  const zkpRequests = message.body?.scope ?? [];

  const msgObj = {
    "Message ID": message.id,
    "Thread ID": message.thid,
    "Message type": message.type,
    From: message.from,
    To: message.to,
    Message: message.body?.message,
    Reason: message.body?.reason,
    "Callback URL": message.body?.callbackUrl,
  };

  const isMulti = zkpRequests.length > 1;
  return (
    <>
      <ObjectGrid obj={msgObj} />
      {zkpRequests.map((req, i) => (
        <>
          <br />
          <p>ZK Proof request{isMulti ? ` ${i + 1}` : ""}:</p>
          <div className="ml-2">
            <ObjectGrid
              obj={{
                "Request ID": req.id,
                "Circuit ID": req.circuitId,
                "Allowed issuers": ((req.query?.allowedIssuers as string[]) ?? []).join(", "),
                "Credential type": req.query?.type,
                Query: formatQuerySubject(req.query),
              }}
            />
          </div>
        </>
      ))}
    </>
  );
}

const OPS: JSONObject = {
  $eq: "=",
  $ne: "≠",
  $lt: "<",
  $gt: ">",
  $in: "IN",
  $nin: "NOT IN",
};

function formatQuerySubject(query?: JSONObject) {
  const s = query?.credentialSubject;
  if (!s) {
    return "???";
  }

  return Object.entries(s)
    .map(([field, comparison]) =>
      Object.entries(comparison)
        .map(([op, val]) => `${field} ${OPS[op] ?? op} ${JSON.stringify(val)}`)
        .join(" AND ")
    )
    .join("\n AND ");

  // return JSON.stringify(query.credentialSubject);
}
