import { code } from "currency-codes";
import invariant from "tiny-invariant";

export function getNumericCurrencyCode(alpha3: string) {
  const rec = code(alpha3);
  invariant(rec, "unsupported country code");
  return Number(rec.number);
}
