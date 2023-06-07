import { CredentialRequest, CredentialStatusType } from "@0xpolygonid/js-sdk";
import { DID } from "@iden3/js-iden3-core";
import invariant from "tiny-invariant";

import config from "~/config.server";
import { getNumericCountryCode } from "~/shared/countries";
import { CredentialRequestType } from "~/shared/credential-request-type";
import { getNumericCurrencyCode } from "~/shared/currencies";

import { credentialWallet, getDID, identityWallet } from "./identity.server";

export async function requestCredential(
  userId: string,
  issuerAlias: string,
  subjectAlias: string,
  credentialType: CredentialRequestType
) {
  const issuerDID = getDID(userId, issuerAlias);
  invariant(issuerDID, "missing issuer DID");

  const subjectDID = getDID(userId, subjectAlias);
  invariant(subjectDID, "missing subject DID");

  const req = getCredentialRequest(subjectDID, credentialType);
  return await issueCredential(userId, issuerAlias, req);
}

function getCredentialRequest(subjectDID: DID, type: CredentialRequestType) {
  switch (type) {
    case CredentialRequestType.FIN_AUM_HIGH:
      return getFinancialAUMRequest(subjectDID, "SGD", 234567);
    case CredentialRequestType.FIN_AUM_LOW:
      return getFinancialAUMRequest(subjectDID, "SGD", 12345);
    case CredentialRequestType.FIN_BANK_ACCOUNT:
      return getFinancialBankAccount(subjectDID);
    case CredentialRequestType.ID_PASSPORT:
      return getPassportRequest(subjectDID);
    case CredentialRequestType.KYC_AGE:
      return getKYCAgeRequest(subjectDID);
    case CredentialRequestType.KYC_COUNTRY_OF_RESIDENCE:
      return getKYCCountryOfResidenceRequest(subjectDID);
    default:
      invariant(false, "invalid credential request type");
  }
}

function getFinancialAUMRequest(
  subjectDID: DID,
  currencyCode: string,
  valuation: number
): Partial<CredentialRequest> {
  invariant(valuation >= 0 && valuation % 1 === 0, "valuation must be a non-negative integer");
  return {
    credentialSchema:
      "https://raw.githubusercontent.com/nedgar/polygon-id-js-sdk-demo/main/schemas/json/AssetsUnderManagement-v1.json",
    type: "AssetsUnderManagement",
    credentialSubject: {
      id: subjectDID.toString(),
      currencyCode: getNumericCurrencyCode(currencyCode),
      valuation,
    },
    expiration: toSeconds(new Date("2030-01-01T00:00:00Z")),
  };
}

function getFinancialBankAccount(subjectDID: DID): Partial<CredentialRequest> {
  return {
    credentialSchema:
      "https://raw.githubusercontent.com/nedgar/polygon-id-js-sdk-demo/main/schemas/json/BankAccountCredential-v1.json",
    type: "BankAccount",
    credentialSubject: {
      id: subjectDID.toString(),
      accountId: "1111111",
      BIC11: "TDOMCATTTOR", // TODO: change to HSBC
      familyName: "Smith",
      givenName: "Alice",
      iban: "GB74GSLD04296280001319",
      routingInfo: {
        code: "GBDSC",
        value: "042962",
      },
      address: {
        streetAddress: "19 Knox St",
        addressLocality: "Toronto",
        addressRegion: "ON",
        addressCountry: "CA",
        postalCode: "M3B 1A2",
      },
    },
    expiration: toSeconds(new Date("2030-01-01T00:00:00Z")),
  };
}

function getKYCAgeRequest(subjectDID: DID): Partial<CredentialRequest> {
  return {
    credentialSchema:
      "https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/KYCAgeCredential-v3.json",
    type: "KYCAgeCredential",
    credentialSubject: {
      id: subjectDID.toString(),
      birthday: 19960424,
      documentType: 99,
    },
    expiration: toSeconds(new Date("2030-01-01T00:00:00Z")),
  };
}

function getKYCCountryOfResidenceRequest(subjectDID: DID): Partial<CredentialRequest> {
  return {
    credentialSchema:
      "https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/KYCCountryOfResidenceCredential-v2.json",
    type: "KYCCountryOfResidenceCredential",
    credentialSubject: {
      id: subjectDID.toString(),
      countryCode: getNumericCountryCode("CA"),
      documentType: 99,
    },
    expiration: toSeconds(new Date("2030-01-01T00:00:00Z")),
  };
}

function getPassportRequest(subjectDID: DID): Partial<CredentialRequest> {
  // Example from Figure 1 at https://www.icao.int/publications/documents/9303_p3_cons_en.pdf
  return {
    credentialSchema:
      "https://raw.githubusercontent.com/nedgar/polygon-id-js-sdk-demo/main/schemas/json/Passport-v1.json",
    type: "PassportCredential",
    credentialSubject: {
      id: subjectDID.toString(),
      countryCode: getNumericCountryCode("UA"),
      passportNumber: "L898902C3",
      documentType: 80, // P in ASCII
    },
    expiration: toSeconds(new Date("2030-01-01T00:00:00Z")),
  };
}

export async function issueCredential(
  userId: string,
  issuerAlias: string,
  req: Partial<CredentialRequest>
) {
  const issuerDID = getDID(userId, issuerAlias);
  invariant(issuerDID, "missing issuer DID");

  const credential = await identityWallet.issueCredential(issuerDID, {
    ...req,
    revocationOpts: {
      baseUrl: config.rhsUrl,
      type: CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
    },
  } as CredentialRequest);
  await credentialWallet.save(credential);

  return credential;
}

function toSeconds(date: Date) {
  return Math.floor(date.valueOf() / 1000);
}
