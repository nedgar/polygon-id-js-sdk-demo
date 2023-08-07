import type {
  AuthDataPrepareFunc,
  CircuitData,
  IAuthHandler,
  ICredentialWallet,
  IIdentityWallet,
  IPackageManager,
  IProofService,
  IStateStorage,
  ProvingParams,
  StateVerificationFunc,
  VerificationParams
} from "@0xpolygonid/js-sdk";
import {
  AuthHandler,
  CircuitId,
  DataPrepareHandlerFunc,
  PackageManager,
  PlainPacker,
  ProofService,
  VerificationHandlerFunc,
  ZKPPacker,
} from "@0xpolygonid/js-sdk";
import { proving } from "@iden3/js-jwz";

import { getCircuitStorage } from "./circuits.server";

function initPackageManager(
  circuitData: CircuitData,
  prepareFn: AuthDataPrepareFunc,
  stateVerificationFn: StateVerificationFunc
): IPackageManager {
  const mapKey = proving.provingMethodGroth16AuthV2Instance.methodAlg.toString();

  const verificationFn = new VerificationHandlerFunc(stateVerificationFn);
  const verificationParamMap: Map<string, VerificationParams> = new Map();
  verificationParamMap.set(mapKey, {
    key: circuitData.verificationKey,
    verificationFn,
  });

  const authInputsHandler = new DataPrepareHandlerFunc(prepareFn);
  const provingParamMap: Map<string, ProvingParams> = new Map();
  provingParamMap.set(mapKey, {
    dataPreparer: authInputsHandler,
    provingKey: circuitData.provingKey,
    wasm: circuitData.wasm,
  });

  const mgr: IPackageManager = new PackageManager();
  const packer = new ZKPPacker(provingParamMap, verificationParamMap);
  const plainPacker = new PlainPacker();
  mgr.registerPackers([packer, plainPacker]);

  return mgr;
}

export async function initServices(
  identityWallet: IIdentityWallet,
  credentialWallet: ICredentialWallet,
  stateStorage: IStateStorage
) {
  const circuitStorage = await getCircuitStorage();

  const proofService: IProofService = new ProofService(
    identityWallet,
    credentialWallet,
    circuitStorage,
    stateStorage,
    { ipfsNodeURL: "https://ipfs.io" }
  );

  const authCircuitData = await circuitStorage.loadCircuitData(CircuitId.AuthV2);
  const packageManager = initPackageManager(
    authCircuitData,
    proofService.generateAuthV2Inputs.bind(proofService),
    proofService.verifyState.bind(proofService)
  );

  const authHandler: IAuthHandler = new AuthHandler(packageManager, proofService);

  return {
    proofService,
    packageManager,
    authHandler,
  };
}
