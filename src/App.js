import React, { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { bsc } from "wagmi/chains";
import { FLASH_LOAN_ADDRESS, FLASH_LOAN_ABI, SUPPORTED_ASSETS, toWei } from "./constants";
import "./App.css";
import { ethers } from "ethers";
import "@rainbow-me/rainbowkit/styles.css";

function App() {
  const { address, isConnected, chain } = useAccount();

  // State variables
  const [tokenSymbol, setTokenSymbol] = useState(SUPPORTED_ASSETS[0].symbol);
  const [amount, setAmount] = useState("");
  const [tokenBSymbol, setTokenBSymbol] = useState(SUPPORTED_ASSETS[1].symbol);
  const [poolBuy, setPoolBuy] = useState("");
  const [poolSell, setPoolSell] = useState("");
  const [buyPoolPrice, setBuyPoolPrice] = useState(null);
  const [sellPoolPrice, setSellPoolPrice] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Get token objects from SUPPORTED_ASSETS
  const token = SUPPORTED_ASSETS.find((asset) => asset.symbol === tokenSymbol); // Borrowing Token
  const tokenB = SUPPORTED_ASSETS.find((asset) => asset.symbol === tokenBSymbol); // Target Token

  // Wagmi hooks for contract interaction
  const { data: hash, isPending, error, writeContract } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Blockchain provider (using BSC RPC)
  const provider = new ethers.JsonRpcProvider(bsc.rpcUrls.default.http[0]);

  // V3 Factory and Pool ABIs (minimal for required functions)
  const V3FactoryAbi = [
    {
      inputs: [
        { internalType: "address", name: "tokenA", type: "address" },
        { internalType: "address", name: "tokenB", type: "address" },
        { internalType: "uint24", name: "fee", type: "uint24" },
      ],
      name: "getPool",
      outputs: [{ internalType: "address", name: "pool", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
  ];

  const V3PoolAbi = [
    {
      inputs: [],
      name: "slot0",
      outputs: [
        { internalType: "uint160", name: "sqrtPriceX96", type: "uint160" },
        { internalType: "int24", name: "tick", type: "int24" },
        { internalType: "uint16", name: "observationIndex", type: "uint16" },
        { internalType: "uint16", name: "observationCardinality", type: "uint16" },
        { internalType: "uint16", name: "observationCardinalityNext", type: "uint16" },
        { internalType: "uint32", name: "feeProtocol", type: "uint32" },
        { internalType: "bool", name: "unlocked", type: "bool" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "token0",
      outputs: [{ internalType: "address", name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "token1",
      outputs: [{ internalType: "address", name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
  ];

  // Factory addresses and fee tiers from the bot script
  const factories = [
    "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865", // PancakeV3Factory
    "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7", // UniswapV3Factory
  ];
  const feeTiers = [100, 500, 2500, 10000]; // 0.01%, 0.05%, 0.25%, 1%

  // Price calculation function
  const calcPriceV3 = (sqrtPriceX96, assetDecimals, tokenDecimals, isT0) => {
    const Q96 = 2 ** 96;
    const sqrtPrice = Number(sqrtPriceX96) / Q96;
    const priceRaw = sqrtPrice ** 2; // token1 per token0
    const price = isT0 ? priceRaw : 1 / priceRaw; // Adjust to pairedToken per asset
    const decimalAdjustment = 10 ** (tokenDecimals - assetDecimals);
    return price * decimalAdjustment; // Returns targetToken per borrowingToken
  };

  // Function to fetch pools and calculate prices
  const fetchPools = async (token0, token1, asset, pairedToken) => {
    const pools = [];
    for (const factoryAddr of factories) {
      const factoryContract = new ethers.Contract(factoryAddr, V3FactoryAbi, provider);
      for (const fee of feeTiers) {
        try {
          const poolAddr = await factoryContract.getPool(token0, token1, fee);
          if (poolAddr !== "0x0000000000000000000000000000000000000000") {
            const poolContract = new ethers.Contract(poolAddr, V3PoolAbi, provider);
            const [token0Pool, token1Pool, slot0] = await Promise.all([
              poolContract.token0(),
              poolContract.token1(),
              poolContract.slot0(),
            ]);
            const isT0 = asset.address.toLowerCase() === token0Pool.toLowerCase();
            const sp = slot0.sqrtPriceX96;
            const price = calcPriceV3(sp, asset.decimals, pairedToken.decimals, isT0);
            pools.push({ poolAddr, price, isT0 });
          }
        } catch (error) {
          console.warn(`Failed to fetch pool for factory ${factoryAddr} and fee ${fee}:`, error);
        }
      }
    }
    return pools;
  };

  // Effect to auto-detect pools when tokens change
  useEffect(() => {
    const detectPools = async () => {
      if (token && tokenB && token.address !== tokenB.address) {
        // Sort tokens for V3 factory getPool (token0 < token1)
        const [token0, token1] =
          token.address < tokenB.address
            ? [token.address, tokenB.address]
            : [tokenB.address, token.address];
        const pools = await fetchPools(token0, token1, token, tokenB);
        if (pools.length > 0) {
          const minPricePool = pools.reduce((prev, curr) =>
            prev.price < curr.price ? prev : curr
          );
          const maxPricePool = pools.reduce((prev, curr) =>
            prev.price > curr.price ? prev : curr
          );
          setPoolBuy(minPricePool.poolAddr);
          setPoolSell(maxPricePool.poolAddr);
          setBuyPoolPrice(minPricePool.price);
          setSellPoolPrice(maxPricePool.price);
          setErrorMessage("");
        } else {
          setPoolBuy("");
          setPoolSell("");
          setBuyPoolPrice(null);
          setSellPoolPrice(null);
          setErrorMessage("No valid pools found for the selected token pair.");
        }
      }
    };
    detectPools();
  }, [token, tokenB]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !poolBuy || !poolSell || parseFloat(amount) <= 0) {
      setErrorMessage("Please fill all fields with valid values.");
      setStatus("error");
      return;
    }
    if (token.address === tokenB.address) {
      setErrorMessage("Borrowing and target tokens must be different.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMessage("");
    try {
      writeContract({
        address: FLASH_LOAN_ADDRESS,
        abi: FLASH_LOAN_ABI,
        functionName: "Execute_Arbitrage_Opportunity",
        args: [
          token.address,
          toWei(amount, token.decimals),
          tokenB.address,
          poolBuy,
          poolSell,
        ],
      });
    } catch (err) {
      setStatus("error");
      setErrorMessage(err.message || "Failed to initiate transaction.");
      console.error("Transaction error:", err);
    }
  };

  // Update status based on transaction states
  useEffect(() => {
    if (isPending) {
      setStatus("loading");
    } else if (isConfirming) {
      setStatus("confirming");
    } else if (isConfirmed) {
      setStatus("success");
    } else if (error) {
      setStatus("error");
      setErrorMessage(error.shortMessage || error.message || "Transaction failed.");
    }
  }, [isPending, isConfirming, isConfirmed, error]);

  // Render logic
  if (!isConnected) {
    return (
      <div className="App">
        <h1>Flash Loan Arbitrage App</h1>
        <ConnectButton />
        <p>Please connect your wallet to proceed.</p>
      </div>
    );
  }

  if (chain?.id !== bsc.id) {
    return (
      <div className="App">
        <h1>Flash Loan Arbitrage App</h1>
        <ConnectButton />
        <p>Please switch to the Binance Smart Chain network.</p>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Flash Loan Arbitrage App</h1>
      <ConnectButton />
      <p>Connected Address: {address}</p>
      <form className="form-container" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Borrowing Token:</label>
          <select
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value)}
          >
            {SUPPORTED_ASSETS.map((asset) => (
              <option key={asset.address} value={asset.symbol}>
                {asset.symbol}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Amount:</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            step="0.01"
            min="0"
            required
          />
        </div>
        <div className="form-group">
          <label>Target Token:</label>
          <select
            value={tokenBSymbol}
            onChange={(e) => setTokenBSymbol(e.target.value)}
          >
            {SUPPORTED_ASSETS.map((asset) => (
              <option key={asset.address} value={asset.symbol}>
                {asset.symbol}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Buy Pool Address (Auto-detected):</label>
          <input type="text" value={poolBuy} readOnly required />
          {buyPoolPrice && (
            <p>
              Price: {buyPoolPrice.toFixed(6)} {tokenB.symbol} per {token.symbol}
            </p>
          )}
        </div>
        <div className="form-group">
          <label>Sell Pool Address (

Auto-detected):</label>
          <input type="text" value={poolSell} readOnly required />
          {sellPoolPrice && (
            <p>
              Price: {sellPoolPrice.toFixed(6)} {tokenB.symbol} per {token.symbol}
            </p>
          )}
        </div>
        <button type="submit" disabled={isPending || isConfirming}>
          {isPending
            ? "Confirming in Wallet..."
            : isConfirming
            ? "Waiting for Confirmation..."
            : "Execute Arbitrage"}
        </button>
      </form>
      {hash && <p className="info">Transaction Hash: {hash}</p>}
      {isConfirming && <p className="info">Waiting for transaction confirmation...</p>}
      {isConfirmed && <p className="success">Transaction confirmed successfully!</p>}
      {(status === "error" || error) && (
        <p className="error">Error: {errorMessage}</p>
      )}
    </div>
  );
}

export default App;