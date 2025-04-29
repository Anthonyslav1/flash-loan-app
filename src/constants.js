import { ethers } from "ethers";

// Replace with your deployed contract address
export const FLASH_LOAN_ADDRESS = "0xdDf86D8A1383E95F67A577f346e18EA6e8e9917E";

// Contract ABI
export const FLASH_LOAN_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_token", type: "address" },
      { internalType: "uint256", name: "_amount", type: "uint256" },
      { internalType: "address", name: "_tokenB", type: "address" },
      { internalType: "address", name: "_poolBuy", type: "address" },
      { internalType: "address", name: "_poolSell", type: "address" },
    ],
    name: "Execute_Arbitrage_Opportunity",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "asset", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "premium", type: "uint256" },
      { internalType: "address", name: "initiator", type: "address" },
      { internalType: "bytes", name: "params", type: "bytes" },
    ],
    name: "executeOperation",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_addressProvider", type: "address" }],
    stateMutability: "payable",
    type: "constructor",
  },
  { stateMutability: "payable", type: "receive" },
  {
    inputs: [],
    name: "ADDRESSES_PROVIDER",
    outputs: [{ internalType: "contract IPoolAddressesProvider", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address payable", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "POOL",
    outputs: [{ internalType: "contract IPool", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

// Supported assets from previous backend code
export const SUPPORTED_ASSETS = [
  { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE", decimals: 18 },
  { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", decimals: 18 },
  { address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", symbol: "BTCB", decimals: 18 },
  { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol: "ETH", decimals: 18 },
  { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18 },
  { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", decimals: 18 },
  { address: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409", symbol: "FDUSD", decimals: 18 },
  { address: "0x26c5e01524d2E6280A48F2c50fF6De7e52E9611C", symbol: "wstETH", decimals: 18 },
];

// Utility to convert amount to smallest unit
export const toWei = (amount, decimals) =>
  ethers.formatUnits(amount.toString(), decimals);