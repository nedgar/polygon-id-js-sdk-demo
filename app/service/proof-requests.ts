import type { ZeroKnowledgeProofRequest } from "@0xpolygonid/js-sdk";
import { CircuitId } from "@0xpolygonid/js-sdk";
import type { Alpha2Code } from "i18n-iso-countries";

import { getNumericCountryCode } from "~/shared/countries";
import { getNumericCurrencyCode } from "~/shared/currencies";

const CCG_TRACEABILITY_CONTEXT_URL =
  "https://w3c-ccg.github.io/traceability-vocab/contexts/traceability-v1.jsonld";
const FIN_ASSETS_CONTEXT_URL =
  "https://raw.githubusercontent.com/nedgar/polygon-id-js-sdk-demo/main/schemas/json-ld/AssetsUnderManagement-v1.json-ld";
const KYC_CONTEXT_URL =
  "https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v3.json-ld";
const PASSPORT_CONTEXT_URL =
  "https://raw.githubusercontent.com/nedgar/polygon-id-js-sdk-demo/main/schemas/json-ld/Passport-v1.json-ld";

const sanctionedCountries: Alpha2Code[] = [
  "AF", // Afghanistan,
  "IR", // Iran
  "KP", // North Korea
  "SS", // South Sudan
  "SY", // Syria
];

export enum ProofRequestId {
  KYC_USER_IS_ADULT = 101,
  KYC_COUNTRY_NOT_SANCTIONED = 102,
  KYC_DISCLOSE_BIRTHDAY = 103,
  PASSPORT_NUMBER_MATCHES = 201,
  PASSPORT_COUNTRY_NOT_SANCTIONED = 202,
  FIN_AUM_CURRENCY_MATCHES = 301,
  FIN_AUM_AMOUNT_OVER_THRESHOLD = 302,
  FIN_DISCLOSE_BANK_ACCOUNT = 303,
}

export function getCountryNotSanctionedProofRequest(): ZeroKnowledgeProofRequest {
  return {
    id: ProofRequestId.KYC_COUNTRY_NOT_SANCTIONED,
    circuitId: CircuitId.AtomicQuerySigV2, // "credentialAtomicQuerySigV2OnChain"
    optional: false,
    query: {
      allowedIssuers: ["*"],
      type: "KYCCountryOfResidenceCredential",
      context: KYC_CONTEXT_URL,
      credentialSubject: {
        countryCode: {
          $nin: sanctionedCountries.map(getNumericCountryCode),
        },
      },
    },
  };
}

export function getFinancialAUMRequests(
  currencyCode: string,
  amount: number
): ZeroKnowledgeProofRequest[] {
  return [
    {
      id: ProofRequestId.FIN_AUM_CURRENCY_MATCHES,
      circuitId: CircuitId.AtomicQuerySigV2,
      optional: false,
      query: {
        allowedIssuers: ["*"],
        type: "AssetsUnderManagement",
        context: FIN_ASSETS_CONTEXT_URL,
        credentialSubject: {
          currencyCode: {
            $eq: getNumericCurrencyCode(currencyCode),
          },
        },
      },
    },
    {
      id: ProofRequestId.FIN_AUM_AMOUNT_OVER_THRESHOLD,
      circuitId: CircuitId.AtomicQuerySigV2,
      optional: false,
      query: {
        allowedIssuers: ["*"],
        type: "AssetsUnderManagement",
        context: FIN_ASSETS_CONTEXT_URL,
        credentialSubject: {
          valuation: {
            $gt: amount,
          },
        },
      },
    },
  ];
}

export function getFinancialBankAccountRequest(): ZeroKnowledgeProofRequest {
  return {
    id: ProofRequestId.FIN_DISCLOSE_BANK_ACCOUNT,
    circuitId: CircuitId.AtomicQuerySigV2,
    optional: false,
    query: {
      allowedIssuers: ["*"],
      type: "BankAccount",
      context: CCG_TRACEABILITY_CONTEXT_URL,
      credentialSubject: {
        iban: {},
      },
    },
  };
}

export function getPassportMatchesRequests(): ZeroKnowledgeProofRequest[] {
  const passportNumber = "L898902C3";
  return [
    {
      id: ProofRequestId.PASSPORT_NUMBER_MATCHES,
      circuitId: CircuitId.AtomicQuerySigV2,
      optional: false,
      query: {
        allowedIssuers: ["*"],
        type: "PassportCredential",
        context: PASSPORT_CONTEXT_URL,
        credentialSubject: {
          passportNumber: {
            $eq: passportNumber,
          },
        },
      },
    },
    {
      id: ProofRequestId.PASSPORT_COUNTRY_NOT_SANCTIONED,
      circuitId: CircuitId.AtomicQuerySigV2,
      optional: false,
      query: {
        allowedIssuers: ["*"],
        type: "PassportCredential",
        context: PASSPORT_CONTEXT_URL,
        credentialSubject: {
          countryCode: {
            $nin: sanctionedCountries.map(getNumericCountryCode),
          },
        },
      },
    },
  ];
}

export function getDiscloseBirthdayRequest(): ZeroKnowledgeProofRequest {
  return {
    id: ProofRequestId.KYC_DISCLOSE_BIRTHDAY,
    circuitId: CircuitId.AtomicQuerySigV2,
    optional: false,
    query: {
      allowedIssuers: ["*"],
      type: "KYCAgeCredential",
      context: KYC_CONTEXT_URL,
      credentialSubject: {
        birthday: {},
      },
    },
  };
}

export function getUserIsAdultProofRequest(): ZeroKnowledgeProofRequest {
  const now = new Date();

  // Subtract 21 years and add one day (if today is their birthday, it counts).
  // This does increment month if needed.
  // Caveat: should really use user's local time, not UTC.
  const dt = new Date(now.getUTCFullYear() - 21, now.getUTCMonth(), now.getUTCDate() + 1);

  const comparisonDateAsNumber =
    dt.getUTCFullYear() * 10000 + (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate();
  return {
    id: ProofRequestId.KYC_USER_IS_ADULT,
    circuitId: CircuitId.AtomicQuerySigV2,
    optional: false,
    query: {
      allowedIssuers: ["*"],
      type: "KYCAgeCredential",
      context: KYC_CONTEXT_URL,
      credentialSubject: {
        birthday: {
          $lt: comparisonDateAsNumber,
        },
      },
    },
  };
}
