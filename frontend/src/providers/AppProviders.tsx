import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { config } from '@/config/wagmi';
import { ActivityProvider } from '@/contexts/ActivityContext';
import { CreditProvider } from '@/contexts/CreditContext';
import { LoansProvider } from '@/contexts/LoansContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { useWallet } from '@/hooks/useWallet';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

const shared = { borderRadius: 'large', fontStack: 'system', overlayBlur: 'small' } as const;

const RAINBOW_THEMES = {
  light: lightTheme({ ...shared, accentColor: '#0E3F4D', accentColorForeground: '#FFFFFF' }),
  dark: darkTheme({ ...shared, accentColor: '#16A2B4', accentColorForeground: '#052026' }),
};

/** Domain providers need wallet state, so they sit inside the wagmi tree. */
function DomainProviders({ children }: { children: ReactNode }) {
  const { account } = useWallet();

  return (
    <ActivityProvider wallet={account}>
      <CreditProvider>
        <LoansProvider>{children}</LoansProvider>
      </CreditProvider>
    </ActivityProvider>
  );
}

/** Keeps the wallet modal in step with the app theme. */
function WalletUi({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  return (
    <RainbowKitProvider theme={RAINBOW_THEMES[theme]} modalSize="compact">
      {children}
    </RainbowKitProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <WalletUi>
            <DomainProviders>{children}</DomainProviders>
          </WalletUi>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
