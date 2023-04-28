import {
  AuthorizationRequestMessage,
  BjjProvider,
  core,
  CredentialRequest,
  CredentialStorage,
  CredentialWallet,
  defaultEthConnectionConfig,
  EthConnectionConfig,
  EthStateStorage,
  ICredentialWallet,
  IDataStorage,
  Identity,
  IdentityStorage,
  IdentityWallet,
  IIdentityWallet,
  InMemoryDataSource,
  InMemoryMerkleTreeStorage,
  InMemoryPrivateKeyStore,
  KMS,
  KmsKeyId,
  KmsKeyType,
  Profile,
  W3CCredential,
} from "@0xpolygonid/js-sdk";

import { BytesHelper, DID } from "@iden3/js-iden3-core";
import { randomBytes } from "crypto";
import invariant from "tiny-invariant";

import config from "~/config.server";

const HOST_URL = "http://wallet.example.org/"; // URL to use for credential identifiers

const { contractAddress: stateContractAddress, rhsUrl, rpcUrl } = config;

interface IdentityData {
  seed: Uint8Array;
  keyId: KmsKeyId;
  did?: DID;
  authCredential?: W3CCredential;
}

declare global {
  var __dataStorage__: IDataStorage;
  var __kms__: KMS;
  var __identityData__: Map<string, Map<string, IdentityData>>;
}

if (!global.__dataStorage__) {
  // storage for identities and their profiles (secondary identities derived from nonce)
  const identityStorage = new IdentityStorage(
    new InMemoryDataSource<Identity>(),
    new InMemoryDataSource<Profile>()
  );

  // storage for W3C Verifiable Credentials (VCs)
  const credentialStorage = new CredentialStorage(new InMemoryDataSource<W3CCredential>());

  // storage for Merkle trees, e.g. for an identity's claims tree, revocations tree, prior roots tree
  const mtDepth = 40;
  const mtStorage = new InMemoryMerkleTreeStorage(mtDepth);

  // JSON RPC connection config
  const ethConnectionConfig: EthConnectionConfig = {
    ...defaultEthConnectionConfig,
    contractAddress: stateContractAddress,
    url: rpcUrl,
  };

  // on-chain storage for ID states and corresponding MT roots for:
  // - claims tree
  // - revocations tree
  // - (previous) roots tree
  const stateStorage = new EthStateStorage(ethConnectionConfig);

  // the various data sources, collected in one object
  global.__dataStorage__ = {
    credential: credentialStorage,
    identity: identityStorage,
    mt: mtStorage,
    states: stateStorage,
  };
}

if (!global.__kms__) {
  // configure KMS with private keystore and BJJ key provider
  global.__kms__ = new KMS();
  const keyStore = new InMemoryPrivateKeyStore();
  const bjjProvider = new BjjProvider(KmsKeyType.BabyJubJub, keyStore);
  global.__kms__.registerKeyProvider(KmsKeyType.BabyJubJub, bjjProvider);
}

export const dataStorage = global.__dataStorage__;
export const kms = global.__kms__;

// credential wallet
export const credentialWallet: ICredentialWallet = new CredentialWallet(dataStorage);

// identity wallet
export const identityWallet: IIdentityWallet = new IdentityWallet(
  kms,
  dataStorage,
  credentialWallet
);

if (!global.__identityData__) {
  global.__identityData__ = new Map<string, Map<string, IdentityData>>();
}

let _identityData = global.__identityData__;

function getIdentityData(userId: string, alias: string): IdentityData | undefined {
  return _identityData.get(userId)?.get(alias);
}

function setIdentityData(userId: string, alias: string, idData: IdentityData) {
  if (!_identityData.has(userId)) {
    _identityData.set(userId, new Map<string, IdentityData>());
  }
  _identityData.get(userId)!.set(alias, idData);
  return idData;
}

export async function createKey(userId: string, alias: string) {
  const seed = Uint8Array.from(randomBytes(32));
  const keyId = await kms.createKeyFromSeed(KmsKeyType.BabyJubJub, seed);
  const _idData = setIdentityData(userId, alias, {
    seed,
    keyId,
  });
  return getIdentityData(userId, alias);
}

export interface KeyData {
  keyId: string;
  publicKey: {
    hex: string;
    p: {
      x: string;
      y: string;
    };
  };
  privateKey: {
    hex: string;
  };
}

export async function getKeyData(userId: string, alias: string): Promise<KeyData | undefined> {
  const idData = getIdentityData(userId, alias);
  if (idData) {
    const publicKey = await kms.publicKey(idData.keyId);
    return {
      keyId: idData.keyId.id, // only serialize the ID part, not the type
      publicKey: {
        hex: publicKey.hex(),
        p: {
          x: publicKey.p[0].toString(),
          y: publicKey.p[1].toString(),
        },
      },
      privateKey: {
        hex: BytesHelper.bytesToHex(idData.seed),
      },
    };
  }
}

export async function createIdentity(userId: string, alias: string) {
  const idData = getIdentityData(userId, alias);
  console.log("createIdentity:", { userId, alias, idData });
  if (!idData) {
    throw new Error("Unknown user ID or alias");
  }
  const { did, credential } = await identityWallet.createIdentity(HOST_URL, {
    method: core.DidMethod.PolygonId,
    blockchain: core.Blockchain.Polygon,
    networkId: core.NetworkId.Mumbai,
    rhsUrl,
    seed: idData.seed,
  });
  idData.did = did;
  idData.authCredential = credential;
  return did;
}

export function getDID(userId: string, alias: string) {
  return getIdentityData(userId, alias)?.did;
}

export function getAuthCredential(userId: string, alias: string) {
  return getIdentityData(userId, alias)?.authCredential;
}

export async function getIssuedCredentials(userId: string, alias: string) {
  const did = getIdentityData(userId, alias)?.did;
  if (did) {
    // no way to query issued creds directly
    const credentials = await credentialWallet.list();
    return credentials.filter(
      (cred) => cred.issuer === did.toString() && !!cred.credentialSubject?.id
    );
  } else {
    return [];
  }
}

export async function getSubjectCredentials(userId: string, alias: string) {
  const did = getIdentityData(userId, alias)?.did;
  if (did) {
    return await credentialWallet.findByQuery({
      credentialSubjectId: did.toString(),
    });
  } else {
    return [];
  }
}

export async function issueCredential(userId: string, issuerAlias: string, req: CredentialRequest) {
  const issuerDID = getIdentityData(userId, issuerAlias)?.did;
  invariant(issuerDID, "missing issuer DID");

  const credential = await identityWallet.issueCredential(issuerDID, req, HOST_URL, {
    withRHS: rhsUrl,
  });
  await credentialWallet.save(credential);

  return credential;
}

export async function findMatchingCredentials(
  userId: string,
  alias: string,
  req: AuthorizationRequestMessage
) {
  const userDID = getIdentityData(userId, alias)?.did;
  const scope = req?.body?.scope;
  invariant(userDID, "missing user DID");
  invariant(scope?.length, "missing or empty scope");

  const [first, ...rest] = scope;

  // find creds matching first query
  let credentials = await credentialWallet.findByQuery({
    ...first.query,
    credentialSubjectId: userDID.toString(),
  });

  // filter down further for any other queries, matching against same claim
  for (const other of rest) {
    credentials = credentials.filter(
      async (cred) =>
        await credentialWallet.findByQuery({
          ...other.query,
          claimId: cred.id,
          credentialSubjectId: userDID.toString(),
        })
    );
  }

  // TODO: filter further if multiple scopes
  console.log("Found credentials matching scope:", scope, credentials);
  return credentials;
}

export async function getStats() {
  let numAliases = 0;
  for (let aliasMap of _identityData.values()) {
    numAliases += aliasMap.size;
  }
  const credentials = await credentialWallet.list();
  return {
    numUsers: _identityData.size,
    numAliases,
    numCredentials: credentials.length,
    credentials,
  };
}

const randomId = Math.random().toString(36).slice(2);
console.log("randomId:", randomId);
