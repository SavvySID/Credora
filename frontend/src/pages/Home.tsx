import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Zap, TrendingUp, Users, Wallet } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              AI-Powered
              <span className="block text-cyan-500">Decentralized Lending</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-3xl mx-auto">
              Get instant credit scores and secure loans using blockchain technology. 
              No intermediaries, no hidden fees, just transparent AI-driven lending.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/dashboard"
                className="btn-primary text-lg px-8 py-4 flex items-center justify-center gap-2 hover:scale-105 transition-transform"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/loan-request"
                className="btn-secondary text-lg px-8 py-4 flex items-center justify-center gap-2 hover:scale-105 transition-transform"
              >
                Request Loan
                <Wallet className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Why Choose Credora?
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Experience the future of lending with our cutting-edge technology
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card p-6 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-cyan-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Instant AI Scoring</h3>
              <p className="text-gray-300">
                Get your credit score in seconds using advanced AI algorithms and blockchain data
              </p>
            </div>

            <div className="card p-6 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-cyan-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Secure & Transparent</h3>
              <p className="text-gray-300">
                All transactions are secured by smart contracts with no hidden fees or intermediaries
              </p>
            </div>

            <div className="card p-6 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-cyan-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Better Rates</h3>
              <p className="text-gray-300">
                Enjoy competitive interest rates thanks to reduced operational costs
              </p>
            </div>

            <div className="card p-6 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-cyan-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Global Access</h3>
              <p className="text-gray-300">
                Access lending services from anywhere in the world, 24/7
              </p>
            </div>

            <div className="card p-6 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-cyan-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Easy Integration</h3>
              <p className="text-gray-300">
                Connect your wallet and start borrowing in minutes
              </p>
            </div>

            <div className="card p-6 text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-cyan-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Future Ready</h3>
              <p className="text-gray-300">
                Built for the 0G chain ecosystem and next-gen blockchain technology
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Get started with Credora in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white">
                1
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Connect Wallet</h3>
              <p className="text-gray-300">
                Connect your MetaMask or any Web3 wallet to get started
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white">
                2
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Get Credit Score</h3>
              <p className="text-gray-300">
                Our AI analyzes your blockchain activity to generate an instant credit score
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white">
                3
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Borrow & Repay</h3>
              <p className="text-gray-300">
                Request loans and repay them with transparent terms and competitive rates
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-cyan-500/10">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Start Your Lending Journey?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of users who are already benefiting from AI-powered decentralized lending
          </p>
          <Link
            to="/dashboard"
            className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2 hover:scale-105 transition-transform"
          >
            Launch App
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Credora</h3>
            <p className="text-gray-400 mb-6">
              AI-Powered Decentralized Lending Platform
            </p>
            <div className="flex justify-center space-x-6">
              <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors">
                Dashboard
              </Link>
              <Link to="/loan-request" className="text-gray-400 hover:text-white transition-colors">
                Request Loan
              </Link>
            </div>
            <div className="mt-6 text-sm text-gray-500">
              © 2025 Credora. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
