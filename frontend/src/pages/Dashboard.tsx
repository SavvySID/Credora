import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
// import { useCreditScore, useZeroGStatus } from '../hooks/useCreditScore';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { TrendingUp, Clock, DollarSign, ArrowRight, Wallet, Shield, Zap, Users, CheckCircle, BarChart3, Activity, CreditCard, PieChart, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface ActivityItem {
  id: string;
  type: 'wallet_connected' | 'credit_score_updated' | 'loan_requested' | 'loan_approved' | 'loan_repaid' | 'real_time_update';
  title: string;
  description: string;
  timestamp: Date;
  icon: string;
  color: string;
}


export default function Dashboard() {
  const { account, balance, isConnected } = useWallet();
  
  // Temporarily use mock data to prevent white screen
  // TODO: Re-enable 0G hooks once services are properly configured
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  
  // Mock data for now to prevent crashes
  const creditScore = {
    creditScore: 750,
    riskLevel: 'Medium' as 'Low' | 'Medium' | 'High',
    confidence: 0.85,
    factors: ['Good transaction history', 'Sufficient balance'],
    walletData: {
      balance: '2.5 ETH',
      transactionCount: 25,
      lastActivity: '2024-01-15T10:30:00Z',
    },
    timestamp: new Date().toISOString(),
    modelVersion: '1.0.0',
    poweredBy: '0G AI/ML Engine',
  };
  const isLoading = false;
  const error = null;
  const isRealTimeConnected = false;
  const zeroGStatus = { initialized: false, pipelineConnected: false, subscriberCount: 0 };
  const refresh = () => {
    console.log('Refresh not available in mock mode');
  };
  
  // Helper function to format time ago
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  };

  // Add activity to the list
  const addActivity = (activity: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    // Check if we already have a similar activity to prevent duplicates
    const hasSimilarActivity = activities.some(existing => 
      existing.type === activity.type && 
      existing.title === activity.title &&
      existing.description === activity.description
    );
    
    if (!hasSimilarActivity) {
      const newActivity: ActivityItem = {
        ...activity,
        id: Date.now().toString(),
        timestamp: new Date(),
      };
      setActivities(prev => [newActivity, ...prev.slice(0, 9)]); // Keep only last 10 activities
    }
  };

  // Mock loan data for demonstration
  const mockLoan = {
    amount: 2.5,
    interest: 0.125,
    totalRepay: 2.625,
    dueDate: '2024-09-15',
    status: 'Active' as const,
  };

  // Track wallet connection
  useEffect(() => {
    if (isConnected && account) {
      // Add wallet connection activity if it's not already tracked
      const hasWalletActivity = activities.some(activity => 
        activity.type === 'wallet_connected' && 
        activity.description.includes(account.slice(0, 6))
      );
      
      if (!hasWalletActivity) {
        addActivity({
          type: 'wallet_connected',
          title: 'Wallet Connected',
          description: `Successfully connected to MetaMask (${account.slice(0, 6)}...${account.slice(-4)})`,
          icon: 'Wallet',
          color: 'blue',
        });
      }
    }
  }, [isConnected, account]);

  // Track credit score updates
  useEffect(() => {
    if (creditScore && account) {
      // Check if we already have a credit score activity for this score
      const hasCreditScoreActivity = activities.some(activity => 
        activity.type === 'credit_score_updated' && 
        activity.description.includes(`Score: ${creditScore.creditScore}`)
      );
      
      if (!hasCreditScoreActivity) {
        addActivity({
          type: 'credit_score_updated',
          title: 'Credit Score Updated',
          description: `New credit score generated: ${creditScore.creditScore}/1000 (${creditScore.riskLevel} Risk)`,
          icon: 'BarChart3',
          color: 'green',
        });
      }
    }
  }, [creditScore, account]);

  // Track real-time connection status
  useEffect(() => {
    if (isRealTimeConnected) {
      const hasRealTimeActivity = activities.some(activity => 
        activity.type === 'real_time_update' && 
        activity.title === 'Real-time Updates Connected'
      );
      
      if (!hasRealTimeActivity) {
        addActivity({
          type: 'real_time_update',
          title: 'Real-time Updates Connected',
          description: 'Connected to 0G Data Pipeline for live credit score updates',
          icon: 'Wifi',
          color: 'cyan',
        });
      }
    }
  }, [isRealTimeConnected]);

  // Track 0G service status changes
  useEffect(() => {
    if (zeroGStatus.initialized && zeroGStatus.pipelineConnected) {
      const hasZeroGActivity = activities.some(activity => 
        activity.type === 'real_time_update' && 
        activity.title === '0G Services Connected'
      );
      
      if (!hasZeroGActivity) {
        addActivity({
          type: 'real_time_update',
          title: '0G Services Connected',
          description: 'All 0G services (Storage, Compute, Pipeline) are operational',
          icon: 'Zap',
          color: 'purple',
        });
      }
    }
  }, [zeroGStatus.initialized, zeroGStatus.pipelineConnected]);

  // Add test activity function
  const addTestActivity = () => {
    addActivity({
      type: 'loan_requested',
      title: 'Loan Request Submitted',
      description: 'Requested a loan of 2.5 ETH at 12.5% interest rate',
      icon: 'CreditCard',
      color: 'orange',
    });
    toast.success('Test activity added!');
  };

  // Add demo activity when component mounts (for demonstration)
  useEffect(() => {
    if (isConnected && activities.length === 0) {
      // Check if we already have a demo activity
      const hasDemoActivity = activities.some(activity => 
        activity.type === 'loan_approved' && 
        activity.title === 'Demo Loan Approved'
      );
      
      if (!hasDemoActivity) {
        // Add a demo loan activity to show the interface
        setTimeout(() => {
          addActivity({
            type: 'loan_approved',
            title: 'Demo Loan Approved',
            description: 'Sample loan data for demonstration purposes',
            icon: 'CheckCircle',
            color: 'green',
          });
        }, 2000); // Show after 2 seconds
      }
    }
  }, [isConnected, activities, addActivity]);

  const getScoreColor = (score: 'High' | 'Medium' | 'Low' | undefined) => {
    switch (score) {
      case 'High':
        return 'bg-green-500';
      case 'Medium':
        return 'bg-yellow-500';
      case 'Low':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get icon component based on string
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Wallet': return Wallet;
      case 'TrendingUp': return TrendingUp;
      case 'CheckCircle': return CheckCircle;
      case 'DollarSign': return DollarSign;
      case 'Activity': return Activity;
      case 'BarChart3': return BarChart3;
      case 'Wifi': return Wifi;
      case 'Zap': return Zap;
      case 'CreditCard': return CreditCard;
      default: return Activity;
    }
  };

  // Get color classes based on color string
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green': return 'bg-green-500/20 text-green-500';
      case 'blue': return 'bg-blue-500/20 text-blue-500';
      case 'purple': return 'bg-purple-500/20 text-purple-500';
      case 'orange': return 'bg-orange-500/20 text-orange-500';
      case 'red': return 'bg-red-500/20 text-red-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Your Financial Dashboard
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Connect your wallet to access your personalized dashboard, view credit scores, and manage your decentralized lending portfolio
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Column - Connect Wallet & Benefits */}
            <div className="space-y-8">
              {/* Connect Wallet Section */}
              <div className="card p-8 text-center">
                <div className="w-24 h-24 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Wallet className="w-12 h-12 text-cyan-500" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h2>
                <p className="text-gray-300 mb-6 text-lg">
                  To access your personalized dashboard, you need to connect your MetaMask or any Web3 wallet first.
                </p>
                <div className="flex justify-center mb-4 hover-lift">
                  <ConnectButton />
                </div>
                <p className="text-sm text-gray-400 mt-4">
                  Don't have a wallet? <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Install MetaMask</a>
                </p>
              </div>

              {/* Dashboard Benefits */}
              <div className="card p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-500" />
                  Why Use Credora Dashboard?
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">Real-time credit score monitoring</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">Track loan status and repayment history</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">AI-powered financial insights</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">Secure and transparent blockchain data</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Link
                    to="/loan-request"
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <span className="text-gray-300">Request a Loan</span>
                    <ArrowRight className="w-4 h-4 text-cyan-500" />
                  </Link>
                  <Link
                    to="/"
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <span className="text-gray-300">Learn More</span>
                    <ArrowRight className="w-4 h-4 text-cyan-500" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Column - Dashboard Features & Context */}
            <div className="space-y-8">
              {/* Dashboard Overview */}
              <div className="card p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-500" />
                  Dashboard Overview
                </h3>
                <div className="space-y-4 text-gray-300">
                  <p>
                    The Credora Dashboard is your central command center for all decentralized lending activities. 
                    Once connected, you'll have access to comprehensive financial insights powered by AI and blockchain technology.
                  </p>
                  <p>
                    Monitor your credit score in real-time, track loan performance, and make informed financial decisions 
                    with transparent, on-chain data.
                  </p>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4">
                    <h4 className="font-medium text-blue-300 mb-2">Wave 1 MVP Dashboard Features</h4>
                    <ul className="text-sm text-blue-200 space-y-1">
                      <li>• Wallet overview and balance tracking</li>
                      <li>• AI-powered credit score display</li>
                      <li>• Active loan management</li>
                      <li>• Basic transaction history</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Key Features Grid */}
              <div className="card p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-500" />
                  Key Features
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                    <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-5 h-5 text-cyan-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm">Credit Score</h4>
                      <p className="text-xs text-gray-400">AI-powered assessment</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm">Loan Management</h4>
                      <p className="text-xs text-gray-400">Track active loans</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Activity className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm">Transaction History</h4>
                      <p className="text-xs text-gray-400">Complete activity log</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <PieChart className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm">Analytics</h4>
                      <p className="text-xs text-gray-400">Financial insights</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* How It Works */}
              <div className="card p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-500" />
                  How It Works
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium text-white">Connect Wallet</h4>
                      <p className="text-sm text-gray-300">Link your Web3 wallet to get started</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      2
                    </div>
                    <div>
                      <h4 className="font-medium text-white">AI Analysis</h4>
                      <p className="text-sm text-gray-300">Get instant credit scoring and insights</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h4 className="font-medium text-white">Monitor & Manage</h4>
                      <p className="text-sm text-gray-300">Track your loans and financial health</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Future Features */}
              <div className="card p-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  Coming Soon
                </h3>
                <div className="space-y-3 text-gray-300">
                  <p className="text-sm">
                    In future waves, the Credora Dashboard will include:
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• Advanced portfolio analytics</li>
                    <li>• Cross-chain asset tracking</li>
                    <li>• DeFi protocol integrations</li>
                    <li>• Social lending features</li>
                    <li>• Real-time market data</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome back!</h1>
          <p className="text-gray-300 text-lg">Manage your loans and track your financial health</p>
          
          {/* Mock Mode Notice */}
          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <span className="text-yellow-500 text-xs font-bold">!</span>
              </div>
              <span className="text-yellow-400 font-medium">Mock Mode Active</span>
            </div>
            <p className="text-yellow-200 text-sm">
              0G services are temporarily disabled to prevent crashes. Using mock data for demonstration.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-gray-400 text-lg">Loading dashboard data...</div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-red-400">!</span>
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Failed to Load Dashboard</h3>
            <p className="text-gray-400 mb-6">{error}</p>
            <button 
              onClick={refresh}
              className="px-6 py-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Stats Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Wallet Balance Card */}
              <div className="card p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-cyan-300">Wallet Balance</p>
                    <p className="text-2xl font-bold text-white">
                      {balance !== null ? `${parseFloat(balance).toFixed(4)} ETH` : 'N/A'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-cyan-500" />
                  </div>
                </div>
              </div>

              {/* Credit Score Card */}
              <div className="card p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-300">Credit Score</p>
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-green-200">Loading...</span>
                      </div>
                    ) : error ? (
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-sm">Error</span>
                        <button 
                          onClick={refresh}
                          className="text-xs text-green-400 hover:text-green-300 underline"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-white">
                          {creditScore?.riskLevel || 'N/A'}
                        </p>
                        {creditScore && (
                          <p className="text-sm text-green-200">
                            {creditScore.creditScore}/1000
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                </div>
              </div>

              {/* Active Loans Card */}
              <div className="card p-6 bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-300">Active Loans</p>
                    <p className="text-2xl font-bold text-white">
                      {mockLoan.status === 'Active' ? '1' : '0'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
              </div>

              {/* Transaction Count Card */}
              <div className="card p-6 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-300">0G Status</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${zeroGStatus.pipelineConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                      <span className="text-sm text-white">
                        {zeroGStatus.pipelineConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <p className="text-xs text-orange-200 mt-1">
                      {zeroGStatus.subscriberCount} subscribers
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    {zeroGStatus.pipelineConnected ? (
                      <Wifi className="w-6 h-6 text-orange-500" />
                    ) : (
                      <WifiOff className="w-6 h-6 text-orange-500" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Wallet Overview Card */}
              <div className="card p-6 col-span-1 lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-white">Wallet Overview</h2>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-400">Connected</span>
                    {isRealTimeConnected && (
                      <>
                        <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                        <span className="text-sm text-cyan-400">Real-time</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-cyan-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Wallet Address</p>
                        <p className="font-mono text-white text-sm break-all">{account}</p>
                      </div>
                    </div>
                    <button className="text-cyan-400 hover:text-cyan-300 text-sm">Copy</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <span className="text-sm text-gray-400">Balance</span>
                      </div>
                      <p className="text-xl font-bold text-white">
                        {balance !== null ? `${parseFloat(balance).toFixed(4)} ETH` : 'N/A'}
                      </p>
                    </div>

                    <div className="p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="w-5 h-5 text-purple-400" />
                        <span className="text-sm text-gray-400">Transaction Count</span>
                      </div>
                      <p className="text-xl font-bold text-white">
                        {creditScore?.walletData?.transactionCount || 'N/A'}
                      </p>
                    </div>

                    <div className="p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <Clock className="w-5 h-5 text-orange-400" />
                        <span className="text-sm text-gray-400">Last Activity</span>
                      </div>
                      <p className="text-xl font-bold text-white">
                        {creditScore?.walletData?.lastActivity ? 
                          formatTimeAgo(new Date(creditScore.walletData.lastActivity)) : 
                          activities.length > 0 ? formatTimeAgo(activities[0].timestamp) : 'Just now'}
                      </p>
                    </div>

                    <div className="p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <Shield className="w-5 h-5 text-blue-400" />
                        <span className="text-sm text-gray-400">Network</span>
                      </div>
                      <p className="text-xl font-bold text-white">Ethereum</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Credit Score Card */}
              <div className="card p-6 flex flex-col items-center justify-center text-center">
                <h2 className="text-2xl font-semibold text-white mb-6">Your Credit Score</h2>
                {isLoading ? (
                  <div className="space-y-4">
                    <div className="w-24 h-24 bg-gray-600 rounded-full flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-400">Loading credit score...</p>
                  </div>
                ) : error ? (
                  <div className="space-y-4">
                    <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-red-400">!</span>
                    </div>
                    <p className="text-red-400 mb-4">Failed to load credit score</p>
                    <button 
                      onClick={refresh}
                      className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : creditScore ? (
                  <>
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${getScoreColor(creditScore.riskLevel)}`}>
                      <span className="text-2xl font-bold text-white">{creditScore.riskLevel}</span>
                    </div>
                    <p className="text-gray-300 mb-4">
                      Based on your on-chain activity and balance.
                    </p>
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          creditScore.riskLevel === 'High' ? 'bg-green-500' : 
                          creditScore.riskLevel === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{
                          width: creditScore.riskLevel === 'High' ? '90%' : 
                                 creditScore.riskLevel === 'Medium' ? '60%' : '30%'
                        }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-400">
                      {creditScore.riskLevel === 'High' && 'Excellent credit standing'}
                      {creditScore.riskLevel === 'Medium' && 'Good credit standing'}
                      {creditScore.riskLevel === 'Low' && 'Credit improvement needed'}
                    </div>
                    {creditScore.confidence && (
                      <div className="mt-4 text-xs text-gray-500">
                        Confidence: {(creditScore.confidence * 100).toFixed(1)}%
                      </div>
                    )}
                    {creditScore.poweredBy && (
                      <div className="mt-4 text-xs text-gray-500">
                        Powered by: {creditScore.poweredBy}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="w-24 h-24 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-400">?</span>
                    </div>
                    <p className="text-gray-400">Credit score not available.</p>
                    <p className="text-sm text-gray-500">Connect your wallet to get started.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 0G Services Status */}
            <div className="mt-8">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-white">0G Services Status</h2>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${zeroGStatus.initialized ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                    <span className="text-sm text-gray-400">
                      {zeroGStatus.initialized ? 'All Services Operational' : 'Services Unavailable'}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Storage Service */}
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-white">0G Storage</h3>
                      <div className={`w-2 h-2 rounded-full ${zeroGStatus.initialized ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    </div>
                    <p className="text-xs text-gray-400">User data storage</p>
                  </div>

                  {/* Compute Service */}
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-white">0G Compute</h3>
                      <div className={`w-2 h-2 rounded-full ${zeroGStatus.initialized ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    </div>
                    <p className="text-xs text-gray-400">AI/ML inference</p>
                  </div>

                  {/* Pipeline Service */}
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-white">0G Pipeline</h3>
                      <div className={`w-2 h-2 rounded-full ${zeroGStatus.pipelineConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    </div>
                    <p className="text-xs text-gray-400">Real-time updates</p>
                  </div>
                </div>

                {!zeroGStatus.initialized && (
                  <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 bg-yellow-500/20 rounded-full flex items-center justify-center">
                        <span className="text-yellow-500 text-xs font-bold">!</span>
                      </div>
                      <span className="text-yellow-400 font-medium">0G Services Unavailable</span>
                    </div>
                    <p className="text-yellow-200 text-sm">
                      Some 0G services are currently unavailable. Credit scoring may be limited. Please try again later.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Loan Section */}
            <div className="mt-8">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-white">Active Loan</h2>
                  {mockLoan.status === 'Active' && (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                        Active
                      </span>
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">
                        Demo Data
                      </span>
                    </div>
                  )}
                </div>

                {mockLoan.status === 'Active' ? (
                  <>
                    {/* Demo Data Notice */}
                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 bg-yellow-500/20 rounded-full flex items-center justify-center">
                          <span className="text-yellow-500 text-xs font-bold">!</span>
                        </div>
                        <span className="text-yellow-400 font-medium">Demo Loan Data</span>
                      </div>
                      <p className="text-yellow-200 text-sm">
                        This is sample loan data for demonstration purposes. In a real scenario, this section would show your actual active loans from the blockchain.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Loan Details */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium text-white mb-4">Loan Details</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-gray-300">Amount Borrowed</span>
                            <span className="text-white font-semibold">{mockLoan.amount} ETH</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-gray-300">Interest Rate</span>
                            <span className="text-cyan-500 font-semibold">5%</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-gray-300">Interest Amount</span>
                            <span className="text-white font-semibold">{mockLoan.interest} ETH</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-gray-300">Total Repayment</span>
                            <span className="text-green-500 font-bold text-lg">{mockLoan.totalRepay} ETH</span>
                          </div>
                        </div>
                      </div>

                      {/* Repayment Info */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium text-white mb-4">Repayment Info</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-gray-300">Due Date</span>
                            <span className="text-white font-semibold">{mockLoan.dueDate}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-gray-300">Days Remaining</span>
                            <span className="text-orange-400 font-semibold">28 days</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-gray-300">Status</span>
                            <span className="text-green-400 font-medium">On Track</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <span className="text-gray-300">Next Payment</span>
                            <span className="text-white font-semibold">Due Soon</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium text-white mb-4">Quick Actions</h3>
                        <div className="space-y-3">
                          <Link 
                            to="/loan-request" 
                            className="btn-primary w-full py-3 flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                          >
                            <DollarSign className="w-5 h-5" />
                            Repay Loan
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                          <button className="btn-secondary w-full py-3 flex items-center justify-center gap-2">
                            <Clock className="w-5 h-5" />
                            Extend Loan
                          </button>
                          <button className="w-full py-3 px-4 border border-gray-600 text-gray-300 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                            <Activity className="w-5 h-5" />
                            View History
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CreditCard className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-medium text-white mb-2">No Active Loans</h3>
                    <p className="text-gray-400 mb-6">You currently have no active loans to manage.</p>
                    <Link 
                      to="/loan-request" 
                      className="btn-primary inline-flex items-center gap-2 px-6 py-3"
                    >
                      <DollarSign className="w-5 h-5" />
                      Request a Loan
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity Section */}
            <div className="mt-8">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-white">Recent Activity</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={refresh}
                      className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
                      title="Refresh credit score"
                    >
                      Refresh Score
                    </button>
                    <button
                      onClick={addTestActivity}
                      className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-lg text-sm hover:bg-orange-500/30 transition-colors"
                      title="Add test activity for demonstration"
                    >
                      + Test
                    </button>
                  </div>
                </div>
                {activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.map((activity) => {
                      const IconComponent = getIconComponent(activity.icon);
                      return (
                        <div key={activity.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-lg">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getColorClasses(activity.color)}`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium">{activity.title}</p>
                            <p className="text-sm text-gray-400">{activity.description}</p>
                          </div>
                          <span className="text-sm text-gray-400">{formatTimeAgo(activity.timestamp)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Activity className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400">No activities yet. Your actions will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
