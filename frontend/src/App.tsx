import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { WalletProvider } from './contexts/WalletContext';
import Header from './components/Header';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import LoanRequest from './pages/LoanRequest';
import './App.css'

function App() {
  return (
    <WalletProvider>
      <div className="App">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/loan-request" element={<LoanRequest />} />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </WalletProvider>
  );
}

export default App;
