# Credora Frontend

AI-powered decentralized lending platform frontend built with React, TypeScript, and Rainbow Kit.

## Features

- 🌈 **Rainbow Kit Integration**: Modern wallet connection with support for multiple wallets
- 🔗 **Wagmi Hooks**: Type-safe Ethereum interactions
- 🎨 **Modern UI**: Beautiful dark theme with glass morphism effects
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ⚡ **Fast Development**: Built with Vite for rapid development

## Wallet Integration

The app now uses Rainbow Kit and Wagmi for wallet connections:

- **Rainbow Kit**: Provides a beautiful wallet modal with support for multiple wallets
- **Wagmi**: Type-safe hooks for Ethereum interactions
- **Supported Chains**: Ethereum Mainnet, Polygon, Optimism, Arbitrum, Base, Sepolia

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3001](http://localhost:3001) in your browser

## Wallet Connection

Click the "Connect Wallet" button in the header to open the Rainbow Kit modal. The modal supports:

- MetaMask
- WalletConnect
- Coinbase Wallet
- And many more wallets

## Project Structure

```
src/
├── components/     # Reusable UI components
├── contexts/       # React contexts (legacy)
├── hooks/          # Custom hooks including useWallet
├── pages/          # Page components
├── providers/      # Wagmi and Rainbow Kit providers
└── config/         # Configuration files
```

## Technologies Used

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Rainbow Kit
- Wagmi
- React Router
- Lucide React Icons
