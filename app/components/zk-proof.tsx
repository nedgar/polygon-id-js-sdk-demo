import type { ZeroKnowledgeProofResponse } from "@0xpolygonid/js-sdk";
import { ObjectGrid } from "./object-grid";

enum Operator {
  NOOP = 0,
  EQ = 1,
  LT = 2,
  GT = 3,
  IN = 4,
  NIN = 5,
  NE = 6,
}

function isMultiValued(op: number) {
  return [Operator.IN, Operator.NIN].includes(op);
}

interface Props {
  circuitId?: string;
  proof: ZeroKnowledgeProofResponse;
}

export function ZKProofDescription({ circuitId, proof }: Props) {
  const header: Array<[string, any] | undefined> = [];
  proof.id && header.push(["Request ID", proof.id]);
  proof.circuitId && header.push(["Circuit ID", proof.circuitId]),
  header.length > 0 && header.push(undefined);

  const entries: Array<[string, any] | undefined> = [
    ...header,
    ["Proof", ""],
    ...Object.entries(proof.proof).map(([key, val]): [string, any] => [`  ${key}`, val]),
    undefined,
    ["Public signals", ""],
    ...decodePublicSignals(circuitId ?? proof.circuitId, proof.pub_signals),
  ];

  return <ObjectGrid entries={entries} />;
}

function decodePublicSignals(circuitId: string, pubSignals: string[]): Array<[string, string]> {
  console.log("decodePublicSignals:", { circuitId, pubSignals });
  if (circuitId === "authV2") {
    const obj = {
      "user ID": pubSignals[0],
      "challenge (hash)": pubSignals[1],
      "GIST root": pubSignals[2],
    };
    return Object.entries(obj).map(([key, val]) => [`  ${key}`, `${val}`]);
  }
  if (circuitId === "credentialAtomicQuerySigV2") {
    let idx = 0,
      op;
    const obj = {
      merklized: pubSignals[idx++],
      "user ID": pubSignals[idx++],
      "issuer auth state": pubSignals[idx++],
      "request ID": pubSignals[idx++],
      "issuer ID": pubSignals[idx++],
      "is revocation checked": pubSignals[idx++],
      "issuer claim non-rev state": pubSignals[idx++],
      timestamp: new Date(Number(pubSignals[idx++]) * 1000).toUTCString(),
      "claim schema hash": pubSignals[idx++],
      "claim path not exists": pubSignals[idx++],
      "claim path key": pubSignals[idx++],
      "slot index": pubSignals[idx++],
      operator: `${(op = Number(pubSignals[idx++]))} (${Operator[op]})`,
      "value(s)": isMultiValued(op) ? pubSignals.slice(idx).join(", ") : pubSignals[idx],
    };
    return Object.entries(obj).map(([key, val]) => [`  ${key}`, `${val}`]);
  }
  return pubSignals.map((val, i) => [`  ${i}`, val]);
}
