import type { AuthorizationResponseMessage } from "@0xpolygonid/js-sdk";
import { ObjectGrid } from "./object-grid";

interface Props {
  message: AuthorizationResponseMessage;
}

export function AuthResponseDescription({ message }: Props) {
  const obj = {
    "Message ID": message.id,
    "Thread ID": message.thid,
    Type: message.type,
    From: message.from,
    To: message.to,
    Message: message.body?.message,
    Proof: "(see ZK Proof response above)",
  };
  return <ObjectGrid obj={obj} />;
}
