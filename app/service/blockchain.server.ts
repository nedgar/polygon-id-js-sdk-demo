import { EthStateStorage } from "@0xpolygonid/js-sdk";
import { ethers, JsonRpcProvider, Wallet } from "ethers";

import { abi as PermissionedERC20ABI } from "~/contracts/abis/PermissionedERC20.json";

import { dataStorage } from "./identity.server";

export enum Role {
  PARTICIPANT = "participant",
}

export interface UserTokenStatus {
  address: string;
  requestsWithProof: number[];
  roles: Role[];
}

// const provider = (dataStorage.states as EthStateStorage).provider;
const provider = new JsonRpcProvider("http://127.0.0.1:8545");

// const wallet = new Wallet("ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
// wallet.getAddress().then(addr => console.log("wallet address:", addr));

const TOKEN_CONTRACT_ADDRESS = "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44";

export const tokenContract = new ethers.Contract(
  TOKEN_CONTRACT_ADDRESS,
  PermissionedERC20ABI,
  provider
);

export async function getUserTokenStatus(address: string): Promise<UserTokenStatus> {
  const requestIds = [1, 2, 3, 4, 5, 6, 7, 8, 101];
  const hasProof: boolean[] = await Promise.all(
    requestIds.map((id) => tokenContract.getProof(address, id))
  );
  console.log("hasProof:", hasProof);

  const requestsWithProof = requestIds.filter((id, i) => hasProof[i]);

  const roles: Role[] = [];
  if (await tokenContract.hasRole(await tokenContract.PARTICIPANT_ROLE(), address)) {
    roles.push(Role.PARTICIPANT);
  }

  return {
    address,
    requestsWithProof,
    roles,
  };
}
