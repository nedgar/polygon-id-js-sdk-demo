import type { AuthorizationRequestMessage } from "@0xpolygonid/js-sdk";
import { Fragment } from "react";

import { formatQuerySubject } from "~/shared/formatting";

import { ObjectGrid } from "./object-grid";

interface Props {
  message: AuthorizationRequestMessage;
}

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
        <Fragment key={i}>
          <br />
          <p>ZKP request {i + 1} of {zkpRequests.length}:</p>
          <div className="ml-2">
            <ObjectGrid
              obj={{
                "Request ID": req.id,
                "Circuit ID": req.circuitId,
                "Allowed issuers": ((req.query?.allowedIssuers as string[]) ?? []).join(", "),
                "Context URL": req.query.context ?? "---",
                "Credential type": req.query?.type,
                Query: formatQuerySubject(req.query),
              }}
            />
          </div>
        </Fragment>
      ))}
    </>
  );
}
