import type { AuthorizationRequestMessage } from "@0xpolygonid/js-sdk";
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
  const zkpRequest = message.body?.scope[0];
  const query = zkpRequest?.query;
  const obj = {
    "Message ID": message.id,
    "Thread ID": message.thid,
    "Message type": message.type,
    From: message.from,
    To: message.to,
    Message: message.body?.message,
    Reason: message.body?.reason,
    "Request ID": zkpRequest?.id,
    "Circuit ID": zkpRequest?.circuitId,
    "Allowed issuers": ((query?.allowedIssuers as string[]) ?? []).join(", "),
    "Credential type": query?.type,
    Query: query?.credentialSubject,
    "Callback URL": message.body?.callbackUrl,
  };
  return <ObjectGrid obj={obj} />;
}
