'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Spline from '@splinetool/react-spline';
import WalletView from '../../components/WalletView';

interface WalletPageProps {
  params: Promise<{
    address: string;
  }>;
}

export default function WalletPage({ params }: WalletPageProps) {
  const router = useRouter();
  const { address } = React.use(params);
  
  // Decode the address parameter (in case it was URL encoded)
  const decodedAddress = decodeURIComponent(address);

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen relative bg-black p-4 sm:p-8 font-mono">
      {/* Spline 3D Background */}
      <div className="fixed inset-0 w-full h-full z-0">
        <Spline
          scene="https://prod.spline.design/nLQdkzIe4ittYQFZ/scene.splinecode" 
        />
      </div>
      
      {/* Content overlay */}
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header with Title */}
        <div className="relative flex flex-col sm:flex-row items-center justify-center mb-8 gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
              <a 
                href="/" 
                className="bg-black text-white px-3 py-1 border border-white hover:bg-white hover:text-black transition-colors duration-200"
              >
                $magic
              </a>
            </h1>
          </div>
        </div>

        {/* Wallet View */}
        <WalletView 
          address={decodedAddress}
          onBack={handleBack}
        />
      </div>
    </div>
  );
} 