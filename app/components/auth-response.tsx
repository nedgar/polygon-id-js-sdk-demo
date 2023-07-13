import type { AuthorizationResponseMessage } from "@0xpolygonid/js-sdk";
import { ObjectGrid } from "./object-grid";

interface Props {
  message: AuthorizationResponseMessage;
}

export function AuthResponseDescription({ message }: Props) {
  const obj = {
    "Thread ID": message.thid,
    "Message ID": message.id,
    Type: message.type,
    From: message.from,
    To: message.to,
    Message: message.body?.message,
    Proofs: "(see ZK Proofs above)",
  };
  return <ObjectGrid obj={obj} />;
}
