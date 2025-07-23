'use client';

import { useState, useEffect } from 'react';

export enum ChainType {
  BITCOIN_MAINNET = "BITCOIN_MAINNET",
  BITCOIN_TESTNET = "BITCOIN_TESTNET",
  BITCOIN_TESTNET4 = "BITCOIN_TESTNET4",
  BITCOIN_SIGNET = "BITCOIN_SIGNET",
  FRACTAL_BITCOIN_MAINNET = "FRACTAL_BITCOIN_MAINNET",
  FRACTAL_BITCOIN_TESTNET = "FRACTAL_BITCOIN_TESTNET",
}

export enum NetworkType {
  MAINNET,
  TESTNET,
}

interface WalletConnectProps {
  onWalletView?: (address: string) => void;
}

// Utility function to truncate address
const truncateAddress = (address: string, startLength: number = 6, endLength: number = 4): string => {
  if (address.length <= startLength + endLength) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};

export default function WalletConnect({ onWalletView }: WalletConnectProps) {
  const [unisatInstalled, setUnisatInstalled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkUnisat() {
      const unisat = (window as any).unisat;
      if (unisat) {
        setUnisatInstalled(true);
        
        try {
          const accounts = await unisat.getAccounts();
          if (accounts.length > 0) {
            setConnected(true);
            setAddress(accounts[0]);
          }
        } catch (e) {
          console.log('Error checking wallet connection:', e);
        }

        unisat.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length > 0) {
            setConnected(true);
            setAddress(accounts[0]);
          } else {
            setConnected(false);
            setAddress('');
          }
        });

        return () => {
          unisat.removeListener('accountsChanged', () => {});
        };
      }
    }

    checkUnisat();
  }, []);

  const handleConnect = async () => {
    try {
      setError(null);
      const unisat = (window as any).unisat;
      const result = await unisat.requestAccounts();
      if (result.length > 0) {
        setConnected(true);
        setAddress(result[0]);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleViewWallet = () => {
    if (address && onWalletView) {
      onWalletView(address);
    }
  };

  const handleDisconnect = async () => {
    try {
      const unisat = (window as any).unisat;
      await unisat.disconnect();
      setConnected(false);
      setAddress('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!unisatInstalled) {
    return (
      <button
        onClick={() => window.open('https://unisat.io', '_blank')}
        className="bg-black/10 backdrop-blur-md border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer group shadow-lg px-4 py-2 text-white group-hover:text-black font-mono text-sm font-medium"
      >
        Install
      </button>
    );
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={handleConnect}
          className="bg-black/10 backdrop-blur-md border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer group shadow-lg px-4 py-2 text-white group-hover:text-black font-mono text-sm font-medium"
        >
          Connect
        </button>
        {error && (
          <div className="text-xs text-red-400">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleViewWallet}
        className="bg-black/10 backdrop-blur-md text-white px-4 py-2 border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer font-mono text-sm font-medium shadow-lg"
      >
        {truncateAddress(address)}
      </button>

      <button
        onClick={handleDisconnect}
        className="bg-black/10 backdrop-blur-md text-white px-2 py-2 border border-white/20 hover:bg-red-500/90 hover:text-white transition-all duration-200 cursor-pointer text-xs shadow-lg"
        title="Disconnect"
      >
        ×
      </button>

      {error && (
        <div className="text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
} 