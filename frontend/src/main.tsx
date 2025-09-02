import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { WagmiProviderWrapper } from './providers/WagmiProvider'
import { RainbowKitProviderWrapper } from './providers/RainbowKitProvider'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProviderWrapper>
      <RainbowKitProviderWrapper>
        <BrowserRouter>
          <App />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </BrowserRouter>
      </RainbowKitProviderWrapper>
    </WagmiProviderWrapper>
  </React.StrictMode>,
)
