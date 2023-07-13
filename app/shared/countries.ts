import type { Alpha2Code } from "i18n-iso-countries";
import { alpha2ToNumeric, numericToAlpha3 } from "i18n-iso-countries";
import invariant from "tiny-invariant";

export function getNumericCountryCode(alpha2: Alpha2Code): number {
  const n = alpha2ToNumeric(alpha2);
  invariant(n, `unsupported country code: ${alpha2}`);
  return Number(n);
}

export function getAlpha3CountryCode(numeric: number) {
  return numericToAlpha3(numeric) ?? "???";
}
