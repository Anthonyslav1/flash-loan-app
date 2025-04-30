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
  const [estimatedProfit, setEstimatedProfit] = useState(null);
  const [isProfitable, setIsProfitable] = useState(false);
  const [gasCost, setGasCost] = useState(0.01); // Default estimated gas cost in BNB
  const [gasCostUsd, setGasCostUsd] = useState(3.0); // Default estimated gas cost in USD
  const [bnbPriceUsd, setBnbPriceUsd] = useState(300); // Default BNB price in USD
  const [poolAttempts, setPoolAttempts] = useState(0);
  const [allPools, setAllPools] = useState([]);
  const [poolCombinations, setPoolCombinations] = useState([]);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

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
    {
      inputs: [],
      name: "fee",
      outputs: [{ internalType: "uint24", name: "", type: "uint24" }],
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

  // AAVE flash loan fee
  const AAVE_FLASH_LOAN_FEE = 0.0009; // 0.09%

  // Price calculation function
  const calcPriceV3 = (sqrtPriceX96, assetDecimals, tokenDecimals, isT0) => {
    const Q96 = BigInt(2) ** BigInt(96);
    // Convert BigInt to Number to avoid mixing types
    const sqrtPriceNum = Number(sqrtPriceX96) / Number(Q96);
    const priceRaw = sqrtPriceNum ** 2; // token1 per token0
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
            const [token0Pool, token1Pool, slot0, poolFee] = await Promise.all([
              poolContract.token0(),
              poolContract.token1(),
              poolContract.slot0(),
              poolContract.fee(),
            ]);
            const isT0 = asset.address.toLowerCase() === token0Pool.toLowerCase();
            const sp = slot0.sqrtPriceX96;
            const price = calcPriceV3(sp, asset.decimals, pairedToken.decimals, isT0);
            pools.push({ poolAddr, price, isT0, fee: Number(poolFee) });
          }
        } catch (error) {
          console.warn(`Failed to fetch pool for factory ${factoryAddr} and fee ${fee}:`, error);
        }
      }
    }
    return pools;
  };

  // Calculate potential profit based on selected tokens, pools and amount
  const calculateProfit = (amount, buyPrice, sellPrice, buyPoolFee, sellPoolFee) => {
    if (!amount || !buyPrice || !sellPrice) return null;
    
    // Ensure all values are regular numbers, not BigInt
    const amountNum = parseFloat(amount);
    const buyPriceNum = Number(buyPrice);
    const sellPriceNum = Number(sellPrice);
    const buyPoolFeeNum = Number(buyPoolFee);
    const sellPoolFeeNum = Number(sellPoolFee);
    
    // Calculate tokenB received from first swap (after fees)
    const buyPoolFeePercentage = buyPoolFeeNum / 1000000; // Convert fee to percentage (e.g. 500 -> 0.0005 or 0.05%)
    const tokenBReceived = amountNum * buyPriceNum * (1 - buyPoolFeePercentage);
    
    // Calculate token received from second swap (after fees)
    const sellPoolFeePercentage = sellPoolFeeNum / 1000000;
    const tokenReceived = tokenBReceived * (1 / sellPriceNum) * (1 - sellPoolFeePercentage);
    
    // Calculate flash loan fee
    const flashLoanFee = amountNum * AAVE_FLASH_LOAN_FEE;
    
    // Calculate profit
    const profit = tokenReceived - amountNum - flashLoanFee;
    
    return profit;
  };

  // Fetch current gas price
  const fetchGasPrice = async () => {
    try {
      const gasPrice = await provider.getFeeData();
      // Convert gas price to BNB and estimate total cost (assuming ~500k gas used)
      const gasPriceInBNB = parseFloat(ethers.formatUnits(gasPrice.gasPrice, "ether"));
      const estimatedGasUsed = 500000; // Approximate gas used for the arbitrage transaction
      return gasPriceInBNB * estimatedGasUsed;
    } catch (error) {
      console.warn("Failed to fetch gas price:", error);
      return 0.01; // Default fallback value
    }
  };

  // Fetch BNB price in USD from CoinGecko
  const fetchBnbPriceInUsd = async () => {
    setIsLoadingPrices(true);
    try {
      // Using CoinGecko API to get BNB price in USD
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
      const data = await response.json();
      setIsLoadingPrices(false);
      if (data && data.binancecoin && data.binancecoin.usd) {
        return parseFloat(data.binancecoin.usd);
      } else {
        console.warn("Failed to fetch BNB price from CoinGecko:", data);
        // Fallback to Binance API
        return fetchBnbPriceFromBinance();
      }
    } catch (error) {
      console.warn("Failed to fetch BNB price from CoinGecko:", error);
      setIsLoadingPrices(false);
      // Fallback to Binance API
      return fetchBnbPriceFromBinance();
    }
  };

  // Backup method to fetch BNB price from Binance API
  const fetchBnbPriceFromBinance = async () => {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
      const data = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      console.warn("Failed to fetch BNB price from Binance:", error);
      return 606; // Default fallback value (approximate BNB price)
    }
  };

  // Calculate gas cost in USD
  const calculateGasCostInUsd = async () => {
    const gasCostInBnb = await fetchGasPrice();
    const bnbPriceInUsd = await fetchBnbPriceInUsd();
    setBnbPriceUsd(bnbPriceInUsd);
    return gasCostInBnb * bnbPriceInUsd;
  };

  // Generate all possible buy/sell pool combinations and select the most profitable one
  const findProfitableTrade = (pools, amountValue) => {
    if (!pools || pools.length < 2 || !amountValue) return null;
    
    const combinations = [];
    
    // Generate all possible buy/sell combinations
    for (let i = 0; i < pools.length; i++) {
      for (let j = 0; j < pools.length; j++) {
        if (i !== j) {  // Don't use the same pool for buying and selling
          const buyPool = pools[i];
          const sellPool = pools[j];
          
          // Only consider if sell price > buy price (potential arbitrage)
          if (sellPool.price > buyPool.price) {
            const profit = calculateProfit(
              amountValue,
              buyPool.price,
              sellPool.price,
              buyPool.fee,
              sellPool.fee
            );
            
            combinations.push({
              buyPool,
              sellPool,
              profit: profit,
              isProfitable: profit > 0  // Basic profitability check before gas costs
            });
          }
        }
      }
    }
    
    // Sort by profit (descending)
    combinations.sort((a, b) => b.profit - a.profit);
    
    return combinations;
  };

  // Try next pool combination
  const tryNextPoolCombination = () => {
    if (poolCombinations.length === 0 || poolAttempts >= 3) return false;
    
    const nextCombination = poolCombinations[poolAttempts];
    if (!nextCombination) return false;
    
    setPoolBuy(nextCombination.buyPool.poolAddr);
    setPoolSell(nextCombination.sellPool.poolAddr);
    setBuyPoolPrice(nextCombination.buyPool.price);
    setSellPoolPrice(nextCombination.sellPool.price);
    
    const profit = nextCombination.profit;
    setEstimatedProfit(profit);
    
    // Get token price in USD to convert profit to USD for comparison
    // For simplicity, we'll assume 1 token = $1 USD
    const tokenPriceUsd = 1.0; // Placeholder
    const profitInUsd = profit * tokenPriceUsd;
    
    // Set profitable flag if profit exceeds gas cost or loss is acceptable (≤ $1)
    const isAcceptableLoss = profitInUsd < 0 && Math.abs(profitInUsd) <= 1;
    const profitable = profitInUsd > 0 || isAcceptableLoss;
    setIsProfitable(profitable);
    
    // Increment attempts counter
    setPoolAttempts(poolAttempts + 1);
    
    return profitable;
  };

  // Effect to auto-detect pools when tokens change
  useEffect(() => {
    const detectPools = async () => {
      if (token && tokenB && token.address !== tokenB.address) {
        // Reset attempts counter when tokens change
        setPoolAttempts(0);
        
        // Sort tokens for V3 factory getPool (token0 < token1)
        const [token0, token1] =
          token.address < tokenB.address
            ? [token.address, tokenB.address]
            : [tokenB.address, token.address];
        const pools = await fetchPools(token0, token1, token, tokenB);
        setAllPools(pools);
        
        if (pools.length > 0) {
          // Calculate all possible pool combinations and sort by profitability
          const combinations = findProfitableTrade(pools, amount);
          setPoolCombinations(combinations);
          
          // Try the first combination
          if (combinations && combinations.length > 0) {
            const bestCombination = combinations[0];
            setPoolBuy(bestCombination.buyPool.poolAddr);
            setPoolSell(bestCombination.sellPool.poolAddr);
            setBuyPoolPrice(bestCombination.buyPool.price);
            setSellPoolPrice(bestCombination.sellPool.price);
            setEstimatedProfit(bestCombination.profit);
            
            // Fetch current gas price and BNB price
            const estimatedGasCost = await fetchGasPrice();
            const bnbPrice = await fetchBnbPriceInUsd();
            const gasCostInUsd = estimatedGasCost * bnbPrice;
            
            setGasCost(estimatedGasCost);
            setGasCostUsd(gasCostInUsd);
            setBnbPriceUsd(bnbPrice);
            
            // Get token price in USD for profit comparison
            const tokenPriceUsd = 1.0; // Placeholder, ideally would fetch real price
            const profitInUsd = bestCombination.profit * tokenPriceUsd;
            
            // Set profitable flag if profit exceeds gas cost or loss is acceptable (≤ $1)
            const isAcceptableLoss = profitInUsd < 0 && Math.abs(profitInUsd) <= 1;
            setIsProfitable(profitInUsd > 0 || isAcceptableLoss);
            setPoolAttempts(1);
          } else {
            resetPoolState();
            setErrorMessage("No profitable pool combinations found for the selected tokens.");
          }
        } else {
          resetPoolState();
          setErrorMessage("No valid pools found for the selected token pair.");
        }
      }
    };
    
    detectPools();
  }, [token, tokenB, amount]);

  // Reset pool state when needed
  const resetPoolState = () => {
    setPoolBuy("");
    setPoolSell("");
    setBuyPoolPrice(null);
    setSellPoolPrice(null);
    setEstimatedProfit(null);
    setIsProfitable(false);
    setPoolCombinations([]);
    setPoolAttempts(0);
  };

  // Handle amount change
  const handleAmountChange = (e) => {
    const newAmount = e.target.value;
    setAmount(newAmount);
    
    // Reset pool attempts when amount changes
    setPoolAttempts(0);
    
    // Recalculate all possible pool combinations with the new amount
    if (allPools && allPools.length > 0 && parseFloat(newAmount) > 0) {
      const combinations = findProfitableTrade(allPools, newAmount);
      setPoolCombinations(combinations);
      
      // Try the first combination
      if (combinations && combinations.length > 0) {
        const bestCombination = combinations[0];
        setPoolBuy(bestCombination.buyPool.poolAddr);
        setPoolSell(bestCombination.sellPool.poolAddr);
        setBuyPoolPrice(bestCombination.buyPool.price);
        setSellPoolPrice(bestCombination.sellPool.price);
        setEstimatedProfit(bestCombination.profit);
        
        // Get token price in USD for profit comparison
        const tokenPriceUsd = 1.0; // Placeholder, ideally would fetch real price
        const profitInUsd = bestCombination.profit * tokenPriceUsd;
        
        // Set profitable flag if profit exceeds gas cost or loss is acceptable (≤ $1)
        const isAcceptableLoss = profitInUsd < 0 && Math.abs(profitInUsd) <= 1;
        setIsProfitable(profitInUsd > 0 || isAcceptableLoss);
        setPoolAttempts(1);
      } else {
        resetPoolState();
        setErrorMessage("No profitable pool combinations found for the selected amount.");
      }
    } else {
      setEstimatedProfit(null);
      setIsProfitable(false);
    }
  };

  // Try different pool button handler
  const handleTryDifferentPools = () => {
    if (tryNextPoolCombination()) {
      setErrorMessage("");
    } else if (poolAttempts >= 3) {
      setErrorMessage("Tried 3 pool combinations. None are profitable or have acceptable loss. Try another token pair.");
    } else {
      setErrorMessage("No more pool combinations available. Try another token pair.");
    }
  };

  // Refresh BNB price manually
  const handleRefreshBnbPrice = async () => {
    try {
      setIsLoadingPrices(true);
      const bnbPrice = await fetchBnbPriceInUsd();
      setBnbPriceUsd(bnbPrice);
      const gasCostInUsd = gasCost * bnbPrice;
      setGasCostUsd(gasCostInUsd);
      
      // Update profitability check with new BNB price
      if (estimatedProfit !== null) {
        const tokenPriceUsd = 1.0; // Placeholder
        const profitInUsd = estimatedProfit * tokenPriceUsd;
        
        // Set profitable flag if profit exceeds gas cost or loss is acceptable (≤ $1)
        const isAcceptableLoss = profitInUsd < 0 && Math.abs(profitInUsd) <= 1;
        setIsProfitable(profitInUsd > 0 || isAcceptableLoss);
      }
      
      setIsLoadingPrices(false);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage("Failed to refresh BNB price. Using last known price.");
      setIsLoadingPrices(false);
    }
  };

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
    
    // Get estimated profit in USD for the acceptable loss check
    const tokenPriceUsd = 1.0; // Placeholder
    const estimatedProfitUsd = estimatedProfit * tokenPriceUsd;
    const estimatedLossUsd = estimatedProfitUsd < 0 ? Math.abs(estimatedProfitUsd) : 0;
    
    // Check if estimated loss is greater than $1 USD
    if (estimatedLossUsd > 1) {
      setErrorMessage(`Cannot execute: Loss greater than $1 (estimated $${estimatedLossUsd.toFixed(2)}). Try another pair.`);
      setStatus("error");
      return;
    }
    
    // Continue with execution if profitable or acceptable loss (≤ $1)
    setStatus("loading");
    setErrorMessage("");
    try {
      writeContract({
        address: FLASH_LOAN_ADDRESS,
        abi: FLASH_LOAN_ABI,
        functionName: "executeArbitrageOpportunity",
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

  // Periodically refresh BNB price (every 2 minutes)
  useEffect(() => {
    const refreshBnbPrice = async () => {
      try {
        const bnbPrice = await fetchBnbPriceInUsd();
        setBnbPriceUsd(bnbPrice);
        const gasCostInUsd = gasCost * bnbPrice;
        setGasCostUsd(gasCostInUsd);
        
        // Update profitability check with new BNB price
        if (estimatedProfit !== null) {
          const tokenPriceUsd = 1.0; // Placeholder
          const profitInUsd = estimatedProfit * tokenPriceUsd;
          
          // Set profitable flag if profit exceeds gas cost or loss is acceptable (≤ $1)
          const isAcceptableLoss = profitInUsd < 0 && Math.abs(profitInUsd) <= 1;
          setIsProfitable(profitInUsd > 0 || isAcceptableLoss);
        }
      } catch (error) {
        console.warn("Failed to auto-refresh BNB price:", error);
      }
    };
    
    // Initial fetch
    refreshBnbPrice();
    
    // Set up interval for refreshing
    const interval = setInterval(refreshBnbPrice, 120000); // Refresh every 2 minutes
    
    // Clean up on unmount
    return () => clearInterval(interval);
  }, [gasCost]);

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
      
      {/* BNB Price Display */}
      <div className="bnb-price-container">
        <p>
          BNB Price: ${bnbPriceUsd.toFixed(2)} USD
          <button 
            onClick={handleRefreshBnbPrice} 
            disabled={isLoadingPrices}
            className="refresh-button"
          >
            {isLoadingPrices ? "Refreshing..." : "Refresh"}
          </button>
        </p>
        <p className="small-text">Price auto-refreshes every 2 minutes</p>
      </div>
      
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
            onChange={handleAmountChange}
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
          <label>Buy Pool Address (Pool {poolAttempts}/3):</label>
          <input type="text" value={poolBuy} readOnly required />
          {buyPoolPrice && (
            <p>
              Price: {buyPoolPrice.toFixed(6)} {tokenB.symbol} per {token.symbol}
            </p>
          )}
        </div>
        <div className="form-group">
          <label>Sell Pool Address (Pool {poolAttempts}/3):</label>
          <input type="text" value={poolSell} readOnly required />
          {sellPoolPrice && (
            <p>
              Price: {sellPoolPrice.toFixed(6)} {tokenB.symbol} per {token.symbol}
            </p>
          )}
        </div>
        
        {/* Profit calculation display */}
        {estimatedProfit !== null && (
          <div className={`profit-display ${estimatedProfit > 0 ? 'profit-positive' : (estimatedProfit < 0 && Math.abs(estimatedProfit) <= 1/bnbPriceUsd) ? 'profit-acceptable' : 'profit-negative'}`}>
            <h3>Profit Calculation</h3>
            <p>Estimated profit: {estimatedProfit.toFixed(6)} {token.symbol} (≈ ${(estimatedProfit).toFixed(2)} USD)</p>
            <p>Gas cost (approx): {gasCost.toFixed(6)} BNB (≈ ${gasCostUsd.toFixed(2)} USD)</p>
            <p>Net profit/loss: {(estimatedProfit - gasCostUsd/bnbPriceUsd).toFixed(6)} {token.symbol} (≈ ${(estimatedProfit - gasCostUsd/bnbPriceUsd*bnbPriceUsd).toFixed(2)} USD)</p>
            
            {/* Status indicator */}
            {estimatedProfit > 0 ? (
              <p className="status-indicator">✅ This trade is profitable!</p>
            ) : estimatedProfit < 0 && Math.abs(estimatedProfit) <= 1/bnbPriceUsd ? (
              <p className="status-indicator">⚠️ Small loss (≤ $1) - Execution allowed</p>
            ) : (
              <p className="status-indicator">❌ Loss exceeds $1 - Execution disabled</p>
            )}
            
            {(!isProfitable || (estimatedProfit < 0 && Math.abs(estimatedProfit) <= 1/bnbPriceUsd)) && poolAttempts < 3 && (
              <button 
                type="button" 
                onClick={handleTryDifferentPools}
                className="try-different-button"
              >
                Try Different Pools ({poolAttempts}/3)
              </button>
            )}
          </div>
        )}
        
        <button 
          type="submit" 
          disabled={isPending || isConfirming || (!isProfitable && estimatedProfit !== null && Math.abs(estimatedProfit) > 1/bnbPriceUsd) || !poolBuy || !poolSell}
          className={(!isProfitable && estimatedProfit !== null && Math.abs(estimatedProfit) > 1/bnbPriceUsd) ? "button-disabled" : ""}
        >
          {isPending
            ? "Confirming in Wallet..."
            : isConfirming
            ? "Waiting for Confirmation..."
            : (!isProfitable && estimatedProfit !== null && Math.abs(estimatedProfit) > 1/bnbPriceUsd)
            ? "Loss > $1 - Execution Disabled"
            : estimatedProfit < 0 && Math.abs(estimatedProfit) <= 1/bnbPriceUsd
            ? "Execute with Small Loss (≤ $1)"
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