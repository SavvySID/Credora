import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import toast from 'react-hot-toast';
import {
  zeroGCreditScoreService,
  type CreditScoreResponse,
  type ZeroGStatusSnapshot,
} from '@/services/0g-credit-score';
import type { CreditScoreUpdateEvent } from '@/services/0g-pipeline';
import {
  api,
  creditAiFromRiskAssessment,
  computeFactsFromProfile,
  type CreditProfileDto,
} from '@/services/api';
import { DEFAULT_ANALYSIS_TYPE, type AnalysisType } from '@/lib/analysis';
import {
  applySessionAiAssessments,
  mergeAssessmentIntoProfile,
  mergePreservingSessionAi,
  writeSessionAiAssessment,
} from '@/lib/aiAssessment';
import { useWallet } from '@/hooks/useWallet';
import { useActivity } from './ActivityContext';

export interface ScorePoint {
  score: number;
  riskLevel: CreditScoreResponse['riskLevel'];
  timestamp: string;
  verified: boolean;
}

export type ZeroGStatus = ZeroGStatusSnapshot;

interface CreditContextValue {
  profile: CreditScoreResponse | null;
  intelligence: CreditProfileDto | null;
  history: ScorePoint[];
  isLoading: boolean;
  isRefreshingScore: boolean;
  isRunningAi: boolean;
  error: string | null;
  isRealTimeConnected: boolean;
  zeroGStatus: ZeroGStatus;
  analysisType: AnalysisType;
  setAnalysisType: (type: AnalysisType) => void;
  displayedAi: CreditProfileDto['ai'] | null;
  hasAttemptedCurrentAnalysis: boolean;
  refresh: () => Promise<void>;
  requestAiAssessment: () => Promise<void>;
}

const CreditContext = createContext<CreditContextValue | undefined>(undefined);

function historyFromProfile(intelligence: CreditProfileDto): ScorePoint[] {
  return intelligence.history
    .filter((point) => point.kind === 'deterministic')
    .map((point) => ({
      score: point.score,
      riskLevel: (point.riskLevel as ScorePoint['riskLevel']) ?? 'Low',
      timestamp: point.timestamp,
      verified: point.verification === 'verified',
    }))
    .slice(-60);
}

function profileFromIntelligence(intelligence: CreditProfileDto): CreditScoreResponse {
  return {
    wallet: intelligence.wallet,
    creditScore: intelligence.deterministic.score,
    creditBand: intelligence.deterministic.creditBand,
    riskLevel: intelligence.deterministic.riskLevel,
    confidence: intelligence.deterministic.confidence,
    factors: intelligence.deterministic.factors,
    walletData: {
      balance: `${intelligence.walletSummary.balanceFormatted} 0G`,
      transactionCount: intelligence.walletSummary.transactionCount,
      lastActivity: intelligence.walletSummary.lastActivity ?? '',
    },
    timestamp: new Date().toISOString(),
    modelVersion: intelligence.deterministic.model,
    poweredBy: 'credora-onchain-v1',
    methodology: intelligence.deterministic.methodology,
    trained: false,
    verification: intelligence.verification
      ? {
          status: intelligence.verification.status,
          rootHash: intelligence.verification.rootHash,
          storageTxHash: intelligence.verification.storageTxHash,
          verifiedAt: intelligence.verification.verifiedAt,
          detail: intelligence.verification.detail,
        }
      : null,
    ai: intelligence.aiByAnalysis?.general ?? intelligence.ai,
    reputation: intelligence.reputation.earned,
  };
}

function aiForType(
  intel: CreditProfileDto | null,
  type: AnalysisType,
): CreditProfileDto['ai'] | null {
  if (!intel) return null;
  const byType = intel.aiByAnalysis?.[type];
  if (byType) return byType;
  if (type === 'general') return intel.ai;
  return null;
}

function mergeAssessment(
  intel: CreditProfileDto,
  type: AnalysisType,
  ai: CreditProfileDto['ai'],
): CreditProfileDto {
  return mergeAssessmentIntoProfile(intel, type, ai);
}

export function CreditProvider({ children }: { children: ReactNode }) {
  const { account, balance, transactionCount, isConnected } = useWallet();
  const { record } = useActivity();

  const [profile, setProfile] = useState<CreditScoreResponse | null>(null);
  const [intelligence, setIntelligence] = useState<CreditProfileDto | null>(null);
  const [history, setHistory] = useState<ScorePoint[]>([]);
  const [isRefreshingScore, setIsRefreshingScore] = useState(false);
  const [isRunningAi, setIsRunningAi] = useState(false);
  const [analysisType, setAnalysisTypeState] = useState<AnalysisType>(DEFAULT_ANALYSIS_TYPE);
  const [attemptedAnalysis, setAttemptedAnalysis] = useState<Partial<Record<AnalysisType, true>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);
  const [zeroGStatus, setZeroGStatus] = useState<ZeroGStatus>(() =>
    zeroGCreditScoreService.getStatus(),
  );
  const accountRef = useRef(account);
  accountRef.current = account;
  const analysisTypeRef = useRef(analysisType);
  analysisTypeRef.current = analysisType;
  const loadGeneration = useRef(0);
  const intelligenceRef = useRef<CreditProfileDto | null>(null);

  const setAnalysisType = useCallback((type: AnalysisType) => {
    setAnalysisTypeState(type);
  }, []);

  const applyIntelligence = useCallback((incoming: CreditProfileDto) => {
    const current = accountRef.current;
    if (!current || current.toLowerCase() !== incoming.wallet.toLowerCase()) return;
    const merged = mergePreservingSessionAi(
      applySessionAiAssessments(incoming, current),
      intelligenceRef.current,
    );
    intelligenceRef.current = merged;
    setIntelligence(merged);
    setProfile(profileFromIntelligence(merged));
    setHistory(historyFromProfile(merged));
  }, []);

  const load = useCallback(async () => {
    if (!account || balance === null || transactionCount === null) return;
    const wallet = account;
    const gen = ++loadGeneration.current;

    setIsRefreshingScore(true);
    setError(null);

    try {
      await api.creditScore(wallet);
      const intel = await api.creditProfile(wallet);
      if (loadGeneration.current !== gen) return;
      applyIntelligence(intel);
      record({
        type: 'credit_score_updated',
        title: 'Credit assessment updated',
        description: `Score ${intel.deterministic.score}/1000 · ${intel.deterministic.creditBand}`,
        tone: 'brand',
        verified: intel.verification?.status === 'verified',
      });
    } catch (err) {
      if (loadGeneration.current !== gen) return;
      const message = err instanceof Error && err.message && err.message !== '[object Object]'
        ? err.message
        : 'Failed to fetch credit score';
      setError(message);
      toast.error(message);
    } finally {
      if (loadGeneration.current === gen) setIsRefreshingScore(false);
    }
  }, [account, balance, transactionCount, applyIntelligence, record]);

  const requestAiAssessment = useCallback(async () => {
    if (!account) return;
    const wallet = account;
    const type = analysisTypeRef.current;
    setAttemptedAnalysis((prev) => ({ ...prev, [type]: true }));
    setIsRunningAi(true);
    try {
      const facts = intelligenceRef.current
        ? computeFactsFromProfile(intelligenceRef.current)
        : undefined;
      const result = await api.riskAssessment(wallet, 'POST', type, facts);
      const fromPost = creditAiFromRiskAssessment(result);
      writeSessionAiAssessment(wallet, type, fromPost);
      if (accountRef.current?.toLowerCase() === wallet.toLowerCase()) {
        const base = intelligenceRef.current;
        if (base && base.wallet.toLowerCase() === wallet.toLowerCase()) {
          const merged = mergeAssessment(base, type, fromPost);
          intelligenceRef.current = merged;
          setIntelligence(merged);
          setProfile(profileFromIntelligence(merged));
          setHistory(historyFromProfile(merged));
        }
      }

      if (accountRef.current?.toLowerCase() === wallet.toLowerCase()) {
        if (fromPost.available) toast.success('0G Compute assessment ready');
        else toast.error(fromPost.blockedReason ?? '0G Compute did not return a result');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run 0G Compute assessment';
      toast.error(message);
    } finally {
      setIsRunningAi(false);
    }
  }, [account]);

  useEffect(() => {
    setProfile(null);
    setIntelligence(null);
    intelligenceRef.current = null;
    setHistory([]);
    setError(null);
    setAnalysisTypeState(DEFAULT_ANALYSIS_TYPE);
    setAttemptedAnalysis({});
    if (!account) return;
    void load();
  }, [account, load]);

  useEffect(() => {
    if (!account) return;

    const unsubscribe = zeroGCreditScoreService.subscribeToCreditScoreUpdates(
      account,
      (event: CreditScoreUpdateEvent) => {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                creditScore: event.data.creditScore,
                riskLevel: event.data.riskLevel,
                confidence: event.data.confidence,
                factors: event.data.factors,
                timestamp: event.timestamp,
              }
            : prev,
        );
        setHistory((prev) => {
          const point: ScorePoint = {
            score: event.data.creditScore,
            riskLevel: event.data.riskLevel,
            timestamp: event.timestamp,
            verified: false,
          };
          const next = [...prev, point];
          return next.slice(-60);
        });
        toast.success('Credit score updated');
      },
    );

    setIsRealTimeConnected(zeroGCreditScoreService.getStatus().pipelineConnected);
    const pulse = window.setInterval(() => {
      setIsRealTimeConnected(zeroGCreditScoreService.getStatus().pipelineConnected);
    }, 3000);

    return () => {
      unsubscribe();
      window.clearInterval(pulse);
      setIsRealTimeConnected(false);
    };
  }, [account]);

  useEffect(() => {
    const tick = () => {
      void zeroGCreditScoreService.refreshHealth().then(setZeroGStatus);
    };
    tick();
    const interval = window.setInterval(tick, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isConnected && account) {
      record({
        type: 'wallet_connected',
        title: 'Wallet connected',
        description: `Session opened for ${account.slice(0, 6)}…${account.slice(-4)}`,
        tone: 'neutral',
        verified: false,
      });
    }
  }, [isConnected, account, record]);

  const isLoading = isRefreshingScore || isRunningAi;
  const displayedAi = aiForType(intelligence, analysisType);
  const hasAttemptedCurrentAnalysis = attemptedAnalysis[analysisType] === true;

  const value = useMemo(
    () => ({
      profile,
      intelligence,
      history,
      isLoading,
      isRefreshingScore,
      isRunningAi,
      error,
      isRealTimeConnected,
      zeroGStatus,
      analysisType,
      setAnalysisType,
      displayedAi,
      hasAttemptedCurrentAnalysis,
      refresh: load,
      requestAiAssessment,
    }),
    [
      profile,
      intelligence,
      history,
      isLoading,
      isRefreshingScore,
      isRunningAi,
      error,
      isRealTimeConnected,
      zeroGStatus,
      analysisType,
      setAnalysisType,
      displayedAi,
      hasAttemptedCurrentAnalysis,
      load,
      requestAiAssessment,
    ],
  );

  return <CreditContext.Provider value={value}>{children}</CreditContext.Provider>;
}

export function useCredit() {
  const context = useContext(CreditContext);
  if (!context) throw new Error('useCredit must be used within a CreditProvider');
  return context;
}
