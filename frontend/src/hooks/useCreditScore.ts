import { useState, useEffect, useCallback } from 'react';
import { zeroGCreditScoreService, CreditScoreResponse } from '../services/0g-credit-score';
import { CreditScoreUpdateEvent } from '../services/0g-pipeline';
import toast from 'react-hot-toast';

export interface UseCreditScoreOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  enableRealTimeUpdates?: boolean;
}

export interface UseCreditScoreReturn {
  creditScore: CreditScoreResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isRealTimeConnected: boolean;
}

export function useCreditScore(
  walletAddress: string | null,
  options: UseCreditScoreOptions = {}
): UseCreditScoreReturn {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    enableRealTimeUpdates = true,
  } = options;

  const [creditScore, setCreditScore] = useState<CreditScoreResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);

  // Fetch credit score function
  const fetchCreditScore = useCallback(async () => {
    if (!walletAddress) {
      setCreditScore(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching credit score for wallet:', walletAddress);
      const result = await zeroGCreditScoreService.getCreditScore(walletAddress);
      setCreditScore(result);
      console.log('Credit score fetched successfully:', result);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch credit score';
      setError(errorMessage);
      console.error('Error fetching credit score:', err);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  // Real-time updates subscription
  useEffect(() => {
    if (!walletAddress || !enableRealTimeUpdates) {
      return;
    }

    console.log('Setting up real-time credit score updates for wallet:', walletAddress);
    
    const unsubscribe = zeroGCreditScoreService.subscribeToCreditScoreUpdates(
      walletAddress,
      (event: CreditScoreUpdateEvent) => {
        console.log('Received real-time credit score update:', event);
        
        if (creditScore && event.wallet === walletAddress) {
          // Update the credit score with new data
          setCreditScore(prev => {
            if (!prev) return prev;
            
            return {
              ...prev,
              creditScore: event.data.creditScore,
              riskLevel: event.data.riskLevel,
              confidence: event.data.confidence,
              factors: event.data.factors,
              timestamp: event.timestamp,
            };
          });
          
          toast.success('Credit score updated in real-time!', {
            duration: 3000,
            icon: '🔄',
          });
        }
      }
    );

    setIsRealTimeConnected(true);

    return () => {
      console.log('Cleaning up real-time credit score subscription for wallet:', walletAddress);
      unsubscribe();
      setIsRealTimeConnected(false);
    };
  }, [walletAddress, enableRealTimeUpdates, creditScore]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !walletAddress) {
      return;
    }

    const interval = setInterval(() => {
      console.log('Auto-refreshing credit score for wallet:', walletAddress);
      fetchCreditScore();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, walletAddress, refreshInterval, fetchCreditScore]);

  // Initial fetch
  useEffect(() => {
    fetchCreditScore();
  }, [fetchCreditScore]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await fetchCreditScore();
  }, [fetchCreditScore]);

  return {
    creditScore,
    isLoading,
    error,
    refresh,
    isRealTimeConnected,
  };
}

// Hook for getting service status
export function useZeroGStatus() {
  const [status, setStatus] = useState(() => zeroGCreditScoreService.getStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(zeroGCreditScoreService.getStatus());
    }, 5000); // Update status every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return status;
}
