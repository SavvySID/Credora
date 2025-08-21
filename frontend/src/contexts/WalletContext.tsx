import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ethers } from 'ethers'

interface WalletContextType {
  account: string | null
  balance: string | null
  isConnected: boolean
  isLoading: boolean
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  provider: ethers.BrowserProvider | null
  signer: ethers.JsonRpcSigner | null
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const useWallet = () => {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

interface WalletProviderProps {
  children: ReactNode
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)

  // Check if MetaMask is installed
  const checkIfWalletIsConnected = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        
        if (accounts.length > 0) {
          const account = accounts[0]
          setAccount(account)
          setIsConnected(true)
          await setupProviderAndSigner()
          await updateBalance(account)
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error)
    }
  }

  const setupProviderAndSigner = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      setProvider(provider)
      setSigner(signer)
    } catch (error) {
      console.error('Error setting up provider and signer:', error)
    }
  }

  const updateBalance = async (accountAddress: string) => {
    try {
      if (provider) {
        const balance = await provider.getBalance(accountAddress)
        setBalance(ethers.formatEther(balance))
      }
    } catch (error) {
      console.error('Error updating balance:', error)
    }
  }

  const connectWallet = async () => {
    try {
      setIsLoading(true)
      
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        })
        
        const account = accounts[0]
        setAccount(account)
        setIsConnected(true)
        await setupProviderAndSigner()
        await updateBalance(account)
      } else {
        alert('Please install MetaMask!')
      }
    } catch (error) {
      console.error('Error connecting wallet:', error)
      alert('Error connecting wallet. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    setBalance(null)
    setIsConnected(false)
    setProvider(null)
    setSigner(null)
  }

  // Listen for account changes
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0])
          updateBalance(accounts[0])
        } else {
          disconnectWallet()
        }
      })

      window.ethereum.on('chainChanged', () => {
        window.location.reload()
      })
    }

    return () => {
      if (typeof window.ethereum !== 'undefined') {
        window.ethereum.removeAllListeners()
      }
    }
  }, [])

  // Check connection on mount
  useEffect(() => {
    checkIfWalletIsConnected()
  }, [])

  const value: WalletContextType = {
    account,
    balance,
    isConnected,
    isLoading,
    connectWallet,
    disconnectWallet,
    provider,
    signer
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

// Extend Window interface for MetaMask
declare global {
  interface Window {
    ethereum?: any
  }
}
