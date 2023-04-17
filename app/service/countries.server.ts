import { Alpha2Code, alpha2ToNumeric } from "i18n-iso-countries";

export function getNumericCountryCode(alpha2: Alpha2Code): number {
  return Number(alpha2ToNumeric(alpha2));
}
