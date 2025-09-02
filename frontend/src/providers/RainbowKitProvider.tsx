import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

export function RainbowKitProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <RainbowKitProvider>
      {children}
    </RainbowKitProvider>
  )
}
