import { code, number } from "currency-codes";
import invariant from "tiny-invariant";

export function getNumericCurrencyCode(alpha3: string) {
  const rec = code(alpha3);
  invariant(rec, `unsupported currency code: ${alpha3}`);
  return Number(rec.number);
}

export function getAlphaCurrencyCode(numeric: number) {
  const rec = number(String(numeric));
  return rec?.code ?? "???";
}
