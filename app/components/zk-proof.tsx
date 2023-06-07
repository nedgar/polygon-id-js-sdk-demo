import type { ZeroKnowledgeProofResponse } from "@0xpolygonid/js-sdk";

import { formatId, toHex } from "~/shared/formatting";

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
  if (proof.id) {
    header.push(["Request ID", proof.id]);
  }
  if (proof.circuitId) {
    header.push(["Circuit ID", proof.circuitId]);
  }
  if (header.length > 0) {
    header.push(undefined);
  }

  const entries: Array<[string, any] | undefined> = [
    ...header,
    ["Proof", ""],
    ...Object.entries(proof.proof).map(([key, val]): [string, any] => [`  ${key}`, val]),
    undefined,
    ["Public signals", ""],
    ...decodePublicSignals(circuitId ?? proof.circuitId, proof.pub_signals),
  ];
  const lastSignal = entries[entries.length - 1];

  const vc = (proof.vp as any)?.verifiableCredential;
  if (vc) {
    const subjectProperties = Object.entries(vc.credentialSubject ?? {})
    entries.push(undefined);
    entries.push(["Verifiable Presentation properties", ""]);
    subjectProperties.forEach(([key, val]) => {
      entries.push([`  ${key}`, val]);
    });
    const lastProp = subjectProperties[subjectProperties.length - 1];
    console.log("last signal and VC prop:", lastSignal, lastProp);
    if (lastSignal && lastProp && String(lastSignal[1]) !== String(lastProp[1])) {
      lastSignal[1] = `${lastSignal[1]} (hash of ${lastProp[0]})`;
    }
  }

  return <ObjectGrid entries={entries} />;
}

function decodePublicSignals(circuitId: string, pubSignals: string[]): Array<[string, string]> {
  console.log("decodePublicSignals:", { circuitId, pubSignals });

  if (circuitId === "authV2") {
    const obj = {
      "user ID": formatId(pubSignals[0]),
      "challenge (hash)": toHex(pubSignals[1]),
      "GIST root": toHex(pubSignals[2]),
    };
    return Object.entries(obj).map(([key, val]) => [`  ${key}`, `${val}`]);
  }

  if (circuitId === "credentialAtomicQuerySigV2") {
    let idx = 0,
      op;
    const obj = {
      merklized: pubSignals[idx++],
      "user ID": formatId(pubSignals[idx++]),
      "issuer auth state": toHex(pubSignals[idx++]),
      "request ID": pubSignals[idx++],
      "issuer ID": formatId(pubSignals[idx++]),
      "is revocation checked": pubSignals[idx++],
      "issuer claim non-rev state": toHex(pubSignals[idx++]),
      timestamp: new Date(Number(pubSignals[idx++]) * 1000).toUTCString(),
      "claim schema hash": toHex(pubSignals[idx++]),
      "claim path not exists": pubSignals[idx++],
      "claim path key": toHex(pubSignals[idx++]),
      "slot index": pubSignals[idx++],
      operator: `${(op = Number(pubSignals[idx++]))} (${Operator[op]})`,
      "value(s)": isMultiValued(op) ? pubSignals.slice(idx).join(", ") : pubSignals[idx],
    };
    return Object.entries(obj).map(([key, val]) => [`  ${key}`, `${val}`]);
  }

  return pubSignals.map((val, i) => [`  ${i}`, val]);
}
