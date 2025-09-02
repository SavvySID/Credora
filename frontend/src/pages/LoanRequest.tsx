import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { DollarSign, Calculator, CheckCircle, XCircle, Shield, Zap, TrendingUp, Users, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoanRequest() {
  const { account, balance, isConnected } = useWallet();
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanStatus, setLoanStatus] = useState<'idle' | 'approved' | 'denied'>('idle');

  const interestRate = 0.05; // 5%
  const estimatedInterest = amount ? parseFloat(amount) * interestRate : 0;
  const totalRepayment = amount ? parseFloat(amount) + estimatedInterest : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate loan processing
    setTimeout(() => {
      const loanAmount = parseFloat(amount);
      const walletBalance = balance ? parseFloat(balance) : 0;
      
      // Simple eligibility check (matching smart contract logic)
      if (walletBalance > 0.5 && loanAmount <= walletBalance * 2) {
        setLoanStatus('approved');
        toast.success('Loan approved! Check your dashboard for details.');
      } else {
        setLoanStatus('denied');
        toast.error('Loan denied. Insufficient balance or amount too high.');
      }
      
      setIsSubmitting(false);
    }, 2000);
  };

  const resetForm = () => {
    setAmount('');
    setLoanStatus('denied');
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Request a Loan
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Get instant credit evaluation and secure your loan with AI-powered scoring
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Column - Connect Wallet & Info */}
            <div className="space-y-8">
              {/* Connect Wallet Section */}
              <div className="card p-8 text-center">
                <div className="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Wallet className="w-10 h-10 text-cyan-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
                <p className="text-gray-300 mb-6">
                  To request a loan, you need to connect your MetaMask or any Web3 wallet first.
                </p>
                <div className="flex justify-center mb-4 hover-lift">
                  <ConnectButton />
                </div>
                <p className="text-sm text-gray-400 mt-4">
                  Don't have a wallet? <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Install MetaMask</a>
                </p>
              </div>

              {/* Loan Benefits */}
              <div className="card p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-500" />
                  Why Choose Credora?
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">Instant approval with AI-powered scoring</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">No hidden fees or intermediaries</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">Transparent smart contract terms</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">Global access 24/7</span>
                  </div>
                </div>
              </div>

              {/* Current Rates */}
              <div className="card p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-500" />
                  Current Rates
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Interest Rate:</span>
                    <span className="text-cyan-500 font-semibold">5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Processing Fee:</span>
                    <span className="text-green-400 font-semibold">0%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Early Repayment:</span>
                    <span className="text-green-400 font-semibold">No Penalty</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Loan Duration:</span>
                    <span className="text-cyan-500 font-semibold">30 days</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Loan Context & Features */}
            <div className="space-y-8">
              {/* Loan Context */}
              <div className="card p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-cyan-500" />
                  About Our Lending
                </h3>
                <div className="space-y-4 text-gray-300">
                  <p>
                    Credora uses advanced AI algorithms to analyze your blockchain activity and provide 
                    instant credit scoring. Our system evaluates transaction history, wallet balance, and 
                    network participation to determine loan eligibility.
                  </p>
                  <p>
                    Unlike traditional banks, we don't require credit checks, paperwork, or lengthy 
                    approval processes. Everything is automated and transparent through smart contracts.
                  </p>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4">
                    <h4 className="font-medium text-blue-300 mb-2">Wave 1 MVP Features</h4>
                    <ul className="text-sm text-blue-200 space-y-1">
                      <li>• Rule-based AI credit scoring</li>
                      <li>• Basic loan eligibility checks</li>
                      <li>• Fixed 5% interest rate</li>
                      <li>• 30-day loan terms</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* How It Works */}
              <div className="card p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-500" />
                  How It Works
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium text-white">Connect Wallet</h4>
                      <p className="text-sm text-gray-300">Link your MetaMask or Web3 wallet</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      2
                    </div>
                    <div>
                      <h4 className="font-medium text-white">AI Credit Scoring</h4>
                      <p className="text-sm text-gray-300">Get instant credit evaluation</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h4 className="font-medium text-white">Request & Receive</h4>
                      <p className="text-sm text-gray-300">Submit loan request and get funds</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Eligibility Requirements */}
              <div className="card p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-cyan-500" />
                  Eligibility Requirements
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">Wallet balance must be greater than 0.5 ETH</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">Loan amount cannot exceed 2x your wallet balance</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">No active loans from previous requests</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">Valid Ethereum address</span>
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
                    In future waves, Credora will integrate with the 0G chain ecosystem and include:
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• Advanced machine learning models</li>
                    <li>• Real-time blockchain data analysis</li>
                    <li>• Cross-chain lending capabilities</li>
                    <li>• DeFi protocol integrations</li>
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Request a Loan
          </h1>
          <p className="text-xl text-gray-300">
            Get instant credit evaluation and secure your loan
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Loan Request Form */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-cyan-500" />
              Loan Application
            </h2>

            {loanStatus === 'idle' && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2">
                    Loan Amount (ETH)
                  </label>
                  <input
                    type="number"
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    step="0.1"
                    min="0.1"
                    className="input-field w-full"
                    required
                  />
                </div>

                {/* Loan Calculator */}
                {amount && (
                  <div className="bg-white/5 rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Calculator className="w-4 h-4" />
                      Loan Summary
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Principal:</span>
                        <span className="text-white">{amount} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Interest (5%):</span>
                        <span className="text-white">{estimatedInterest.toFixed(3)} ETH</span>
                      </div>
                      <div className="flex justify-between border-t border-white/20 pt-2">
                        <span className="text-gray-300 font-medium">Total Repayment:</span>
                        <span className="text-cyan-500 font-bold">{totalRepayment.toFixed(3)} ETH</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Eligibility Requirements */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-300 mb-2">Eligibility Requirements</h3>
                  <ul className="text-xs text-blue-200 space-y-1">
                    <li>• Wallet balance must be greater than 0.5 ETH</li>
                    <li>• Loan amount cannot exceed 2x your wallet balance</li>
                    <li>• Fixed interest rate of 5%</li>
                    <li>• No credit checks or paperwork required</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !amount}
                  className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Processing...' : 'Submit Loan Request'}
                </button>
              </form>
            )}

            {/* Loan Status */}
            {loanStatus === 'approved' && (
              <div className="text-center space-y-4">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
                <h3 className="text-xl font-semibold text-white">Loan Approved!</h3>
                <p className="text-gray-300">
                  Your loan request has been approved. The funds will be transferred to your wallet shortly.
                </p>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-left">
                  <h4 className="font-medium text-green-300 mb-2">Loan Details</h4>
                  <div className="text-sm text-green-200 space-y-1">
                    <div>Amount: {amount} ETH</div>
                    <div>Interest: {estimatedInterest.toFixed(3)} ETH</div>
                    <div>Total: {totalRepayment.toFixed(3)} ETH</div>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="btn-secondary px-6 py-2"
                >
                  Request Another Loan
                </button>
              </div>
            )}

            {loanStatus === 'denied' && (
              <div className="text-center space-y-4">
                <XCircle className="w-16 h-16 text-red-400 mx-auto" />
                <h3 className="text-xl font-semibold text-white">Loan Denied</h3>
                <p className="text-gray-300">
                  Unfortunately, your loan request has been denied. Please check the eligibility requirements.
                </p>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-left">
                  <h4 className="font-medium text-red-300 mb-2">Possible Reasons</h4>
                  <ul className="text-sm text-red-200 space-y-1">
                    <li>• Insufficient wallet balance</li>
                    <li>• Loan amount too high</li>
                    <li>• Does not meet minimum requirements</li>
                  </ul>
                </div>
                <button
                  onClick={resetForm}
                  className="btn-secondary px-6 py-2"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* Wallet Info & Stats */}
          <div className="space-y-6">
            {/* Wallet Information */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Your Wallet</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Address:</span>
                  <span className="text-white font-mono text-sm">
                    {account?.slice(0, 6)}...{account?.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Balance:</span>
                  <span className="text-white font-semibold">
                    {balance ? `${parseFloat(balance).toFixed(4)} ETH` : 'Loading...'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Max Loan:</span>
                  <span className="text-cyan-500 font-semibold">
                    {balance ? `${(parseFloat(balance) * 2).toFixed(2)} ETH` : '0.00 ETH'}
                  </span>
                </div>
              </div>
            </div>

            {/* Loan Benefits */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Why Choose Credora?</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">Instant approval with AI-powered scoring</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">No hidden fees or intermediaries</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">Transparent smart contract terms</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">Global access 24/7</span>
                </div>
              </div>
            </div>

            {/* Current Rates */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Current Rates</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Interest Rate:</span>
                  <span className="text-cyan-500 font-semibold">5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Processing Fee:</span>
                  <span className="text-green-400 font-semibold">0%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Early Repayment:</span>
                  <span className="text-green-400 font-semibold">No Penalty</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
