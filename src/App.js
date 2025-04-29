import React, { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { bsc } from "wagmi/chains";
import { FLASH_LOAN_ADDRESS, FLASH_LOAN_ABI, SUPPORTED_ASSETS, toWei } from "./constants";
import "./App.css";
import { ethers } from "ethers";
function App() {
  const { address, isConnected } = useAccount();
  const { chain } = useAccount();

  const [tokenSymbol, setTokenSymbol] = useState(SUPPORTED_ASSETS[0].symbol);
  const [amount, setAmount] = useState("");
  const [tokenBSymbol, setTokenBSymbol] = useState(SUPPORTED_ASSETS[1].symbol);
  const [poolBuy, setPoolBuy] = useState("");
  const [poolSell, setPoolSell] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const token = SUPPORTED_ASSETS.find((asset) => asset.symbol === tokenSymbol);
  const tokenB = SUPPORTED_ASSETS.find((asset) => asset.symbol === tokenBSymbol);

  const { write, isLoading, isSuccess } =  useWriteContract({
    address: FLASH_LOAN_ADDRESS,
    abi: FLASH_LOAN_ABI,
    functionName: "Execute_Arbitrage_Opportunity",
    args: [
      token ? token.address : ethers.ZeroAddress,
      amount && token ? toWei(amount, token.decimals) : 0,
      tokenB ? tokenB.address : ethers.ZeroAddress,
      poolBuy,
      poolSell,
    ],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!write || !amount || !poolBuy || !poolSell || parseFloat(amount) <= 0) {
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
      const tx = await write();
      await tx.wait();
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error.message || "Transaction failed.");
      console.error("Arbitrage error:", error);
    }
  };

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
      <div className="form-container">
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
          <label>Buy Pool Address:</label>
          <input
            type="text"
            value={poolBuy}
            onChange={(e) => setPoolBuy(e.target.value)}
            placeholder="Enter Buy Pool Address"
          />
        </div>
        <div className="form-group">
          <label>Sell Pool Address:</label>
          <input
            type="text"
            value={poolSell}
            onChange={(e) => setPoolSell(e.target.value)}
            placeholder="Enter Sell Pool Address"
          />
        </div>
        <button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? "Processing..." : "Execute Arbitrage"}
        </button>
      </div>
      {isSuccess && <p className="success">Transaction successful!</p>}
      {status === "error" && <p className="error">Error: {errorMessage}</p>}
    </div>
  );
}

export default App;