import { ethers } from "ethers";

// Replace with your deployed contract address
export const FLASH_LOAN_ADDRESS = "0x482a51c070E0015DAA7DE443B2E2014F61a29842";

// Contract ABI
export const FLASH_LOAN_ABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "tokenB",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "poolBuy",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "poolSell",
				"type": "address"
			}
		],
		"name": "executeArbitrageOpportunity",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "asset",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "premium",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "initiator",
				"type": "address"
			},
			{
				"internalType": "bytes",
				"name": "params",
				"type": "bytes"
			}
		],
		"name": "executeOperation",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			}
		],
		"name": "preApproveToken",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_addressProvider",
				"type": "address"
			}
		],
		"stateMutability": "payable",
		"type": "constructor"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	},
	{
		"inputs": [],
		"name": "ADDRESSES_PROVIDER",
		"outputs": [
			{
				"internalType": "contract IPoolAddressesProvider",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address payable",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "POOL",
		"outputs": [
			{
				"internalType": "contract IPool",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
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

// Utility to convert amount to smallest unit (wei)
export const toWei = (amount, decimals) => {
  if (!amount || isNaN(parseFloat(amount))) {
    throw new Error("Invalid amount: must be a valid number");
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error("Invalid decimals: must be a non-negative integer");
  }
  try {
    return ethers.parseUnits(amount.toString(), decimals);
  } catch (err) {
    throw new Error(`Failed to convert amount to wei: ${err.message}`);
  }
};