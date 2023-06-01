import type { W3CCredential } from "@0xpolygonid/js-sdk";
import { ObjectGrid, NBSP } from "./object-grid";
import { getFieldFormatter } from "~/shared/formatting";

interface Props {
  cred: W3CCredential;
}

export function CredentialDescription({ cred }: Props) {
  const { id: subjectId, type: subjectType, ...subjectRest } = cred.credentialSubject;
  const proof = Array.isArray(cred.proof) ? cred.proof[0] : undefined;
  const entries: Array<[string, any] | undefined> = [
    ["Credential ID", cred.id],
    ["Type(s)", cred.type.join(", ")],
    ["Schema URL", cred.credentialSchema.id],
    ["Issuer DID", cred.issuer],
    ["Subject DID", subjectId ?? "(self)"],
    undefined,
    ["Properties", ""],
    ...Object.entries(subjectRest).map(([f, v]) => [`  ${f}`, formatField(f, v)] as [string, any]),
    undefined,
    ["Issued at", formatDate(cred.issuanceDate)],
    ["Expires at", formatDate(cred.expirationDate)],
    ["Proof type", proof?.type],
    ["Signature", proof?.signature],
  ];
  return <ObjectGrid entries={entries} />;
}

function formatDate(dateStr?: string) {
  return dateStr ? new Date(dateStr).toUTCString() : "---";
}

function formatField(field: string, val: any) {
  const fmt = getFieldFormatter(field);
  return fmt ? `${val} (${fmt(val)})` : `${val}`;
}
