import type { JSONObject } from "@0xpolygonid/js-sdk";

import { getAlpha3CountryCode } from "./countries";
import { getAlphaCurrencyCode } from "./currencies";
import { Id } from "./iden3/id";

const OPS: JSONObject = {
  $eq: "=",
  $ne: "≠",
  $lt: "<",
  $gt: ">",
  $in: "IN",
  $nin: "NOT IN",
};

export function formatValue(val: any) {
    if (typeof val === 'string') {
        return val;
    }
    return JSON.stringify(val, null, " ");
}

export function getFieldFormatter(field: string) {
  switch (field) {
    case "countryCode":
      return getAlpha3CountryCode;
    case "currencyCode":
      return getAlphaCurrencyCode;
    default:
      return null;
  }
}

function formatQuery(field: string, op: string, val: any): string {
  const opText = OPS[op] ?? op;

  const fmt = getFieldFormatter(field);
  const values = Array.isArray(val) ? val : [val];
  const formatted = fmt && values.map(fmt);

  return `${field} ${opText} ${JSON.stringify(val)}${
    formatted ? " (" + formatted.join(", ") + ")" : ""
  }`;
}

export function formatQuerySubject(query?: JSONObject) {
  const sub = query?.credentialSubject;
  if (!sub) {
    return "???";
  }

  return Object.entries(sub)
    .map(([field, comparison]) => {
      const entries = Object.entries(comparison);
      if (entries.length === 0) {
        return `${field} (selective disclosure)`;
      } else {
        return Object.entries(comparison)
          .map(([op, val]) => formatQuery(field, op, val))
          .join(" AND ");
      }
    })
    .join("\n AND ");
}

export function formatId(s: string) {
    return Id.fromBigInt(BigInt(s)).string();
}

export function toHex(s: string) {
  return `0x${BigInt(s).toString(16)}`;
}

export const boolToSymbol = (val?: boolean) => (val ? "✅" : val === false ? "❌" : "❓");
