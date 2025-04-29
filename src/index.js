// 1. Imports
import React from 'react';
import { createRoot } from 'react-dom/client';                        // React 18 root API :contentReference[oaicite:2]{index=2}
import App from './App';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; 
import { WagmiProvider }                    from 'wagmi';               // Wagmi v2 provider :contentReference[oaicite:3]{index=3}
import { RainbowKitProvider }               from '@rainbow-me/rainbowkit';

import { wagmiConfig } from './config';
import '@rainbow-me/rainbowkit/styles.css';

// 2. Create React 18 root
const container = document.getElementById('root');
const root = createRoot(container);

// 3. Instantiate a React Query client
const queryClient = new QueryClient();

// 4. Render the app with both Wagmi and React Query providers
root.render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);

