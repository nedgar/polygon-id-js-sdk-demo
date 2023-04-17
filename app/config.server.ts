export default {
  rhsUrl: process.env.RHS_URL ?? "https://rhs-staging.polygonid.me",
  rpcUrl:
    process.env.RPC_URL ?? "https://polygon-mumbai.g.alchemy.com/v2/YOUR_ALCHEMY_KEY",
  contractAddress:
    process.env.CONTRACT_ADDRESS ??
    "0x134B1BE34911E39A8397ec6289782989729807a4", // for State contract
  // walletKey: process.env.WALLET_KEY ?? "YOUR_PRIVATE_KEY",
};
