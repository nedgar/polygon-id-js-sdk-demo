import { CredentialRequest } from "@0xpolygonid/js-sdk";
import { DID } from "@iden3/js-iden3-core";
import invariant from "tiny-invariant";

import { getNumericCountryCode } from "./countries.server";
import { getDID, issueCredential } from "./identity.server";

export enum CredentialType {
  ID_PASSPORT = "id:passport",
  KYC_AGE = "kyc:age",
  KYC_COUNTRY_OF_RESIDENCE = "kyc:countryOfResidence",
}

export async function requestCredential(
  userId: string,
  issuerAlias: string,
  subjectAlias: string,
  credentialType: CredentialType
) {
  const issuerDID = getDID(userId, issuerAlias);
  invariant(issuerDID, "missing issuer DID");

  const subjectDID = getDID(userId, subjectAlias);
  invariant(subjectDID, "missing subject DID");

  const req = getCredentialRequest(subjectDID, credentialType);
  return await issueCredential(userId, issuerAlias, req);
}

function getCredentialRequest(subjectDID: DID, credentialType: CredentialType): CredentialRequest {
  switch (credentialType) {
    case CredentialType.ID_PASSPORT:
      return getPassportRequest(subjectDID);
    case CredentialType.KYC_AGE:
      return getKYCAgeRequest(subjectDID);
    case CredentialType.KYC_COUNTRY_OF_RESIDENCE:
      return getKYCCountryOfResidenceRequest(subjectDID);
    default:
      invariant(false, "invalid credential type");
  }
}

function getKYCAgeRequest(subjectDID: DID): CredentialRequest {
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

function getKYCCountryOfResidenceRequest(subjectDID: DID): CredentialRequest {
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

function getPassportRequest(subjectDID: DID): CredentialRequest {
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

function toSeconds(date: Date) {
  return Math.floor(date.valueOf() / 1000);
}
