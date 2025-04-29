import { createConfig, WagmiConfig }   from 'wagmi';                // Wagmi v2 core API :contentReference[oaicite:3]{index=3}
import { bsc }                         from 'wagmi/chains';         // BSC chain metadata :contentReference[oaicite:4]{index=4}
import { http }                        from 'viem';                  // Viem’s HTTP transport :contentReference[oaicite:5]{index=5}
import { getDefaultWallets, RainbowKitProvider }   from '@rainbow-me/rainbowkit'; // RainbowKit v2 helpers :contentReference[oaicite:6]{index=6}

const projectId = "fa48b9d2b4e2799fe5f691d114553e81"; // Required :contentReference[oaicite:6]{index=6}
// 3. Set up RainbowKit connectors:
//
export const wagmiConfig = createConfig({
  autoConnect: true,
  chains: [bsc],   // Array of chains to support :contentReference[oaicite:7]{index=7}
  transports: {
    [bsc.id]: http(),  // Map each chain’s ID → Viem transport :contentReference[oaicite:8]{index=8}
  },
  connectors: getDefaultWallets({   // RainbowKit connectors for Wagmi v2 :contentReference[oaicite:9]{index=9}
    appName: 'Flash Loan Arbitrage App',
    chains: [bsc],projectId ,
  }).connectors,
});
