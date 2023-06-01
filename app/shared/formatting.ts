import { JSONObject } from "@0xpolygonid/js-sdk";
import { getAlpha3CountryCode } from "./countries";
import { getAlphaCurrencyCode } from "./currencies";

const OPS: JSONObject = {
  $eq: "=",
  $ne: "≠",
  $lt: "<",
  $gt: ">",
  $in: "IN",
  $nin: "NOT IN",
};

export function formatField(field: string, val: any): string {
  switch (field) {
    case "countryCode":
      return getAlpha3CountryCode(val);
    case "currencyCode":
      return getAlphaCurrencyCode(val);
    default:
      return String(val);
  }
}

function formatQuery(field: string, op: string, val: any): string {
  const opText = OPS[op] ?? op;
  const arr = Array.isArray(val) ? val : [val];
  let texts;
  switch (field) {
    case "countryCode":
    case "currencyCode":
      texts = arr.map((v) => formatField(field, v));
  }
  const text = texts ? "(" + texts.join(", ") + ")" : "";
  return `${field} ${opText} ${JSON.stringify(val)} ${text}`;
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
