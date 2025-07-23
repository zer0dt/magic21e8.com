'use client';

import { useState, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import { copyToClipboard } from '../../lib/utils';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

// API Response interfaces
interface UnisatInscription {
  inscriptionId: string;
  inscriptionNumber: number;
  address: string;
  contentType: string;
  contentLength: number;
  offset: number;
  timestamp: number;
  utxo: {
    txid: string;
    vout: number;
    satoshi: number;
    scriptPk: string;
    address: string;
    height: number;
    idx: number;
  };
}

interface UnisatApiResponse {
  code: number;
  msg: string;
  data: {
    cursor: number;
    total: number;
    totalConfirmed: number;
    inscription: UnisatInscription[];
  };
}

interface MagicMint {
  inscriptionId: string;
  inscriptionNumber: string;
  index: number;
  blockHeight: number;
  found: boolean;
}

interface Block {
  index: number;
  height: number;
  hash: string;
  time: number;
}

interface CachedMintData {
  index: number;
  blockHeight: number;
  blockHash: string;
  blockTime: string;
  found: boolean;
  inscriptionId?: string;
  inscriptionNumber?: string;
  transactionId?: string;
}

interface WalletViewProps {
  address: string;
  onBack: () => void;
}

function HighlightedHash({ hash }: { hash: string }) {
  // Find all positions of "21e8" in the original hash
  const find21e8Positions = (str: string) => {
    const positions = [];
    let pos = str.indexOf('21e8');
    while (pos !== -1) {
      positions.push({ start: pos, end: pos + 4 });
      pos = str.indexOf('21e8', pos + 1);
    }
    return positions;
  };
  
  const positions21e8 = find21e8Positions(hash);
  
  // Split hash into 3 rows of approximately equal length
  const charsPerRow = Math.ceil(hash.length / 3);
  const rows = [
    { text: hash.substring(0, charsPerRow), start: 0 },
    { text: hash.substring(charsPerRow, charsPerRow * 2), start: charsPerRow },
    { text: hash.substring(charsPerRow * 2), start: charsPerRow * 2 }
  ];
  
  const renderRowWithHighlight = (row: { text: string; start: number }) => {
    const rowEnd = row.start + row.text.length;
    const result = [];
    let lastIndex = 0;
    
    // Find which 21e8 positions overlap with this row
    positions21e8.forEach(pos => {
      const overlapStart = Math.max(pos.start, row.start);
      const overlapEnd = Math.min(pos.end, rowEnd);
      
      if (overlapStart < overlapEnd) {
        // There's an overlap
        const localStart = overlapStart - row.start;
        const localEnd = overlapEnd - row.start;
        
        // Add text before the highlight
        if (localStart > lastIndex) {
          result.push(
            <span key={`text-${lastIndex}`} className="text-white group-hover:text-black transition-colors duration-200">
              {row.text.substring(lastIndex, localStart)}
            </span>
          );
        }
        
        // Add the highlighted part
        result.push(
          <span key={`highlight-${pos.start}`} className="bg-white/90 backdrop-blur-sm group-hover:bg-black/90 text-black group-hover:text-white px-1 py-0.5 font-bold transition-all duration-200">
            {row.text.substring(localStart, localEnd)}
          </span>
        );
        
        lastIndex = localEnd;
      }
    });
    
    // Add remaining text
    if (lastIndex < row.text.length) {
      result.push(
        <span key={`text-${lastIndex}`} className="text-white group-hover:text-black transition-colors duration-200">
          {row.text.substring(lastIndex)}
        </span>
      );
    }
    
    return result.length > 0 ? result : (
      <span className="text-white group-hover:text-black transition-colors duration-200">
        {row.text}
      </span>
    );
  };
  
  return (
    <div className="font-mono text-base leading-relaxed text-center">
      {rows.map((row, index) => (
        <div key={index} className="mb-1 last:mb-0">
          {renderRowWithHighlight(row)}
        </div>
      ))}
    </div>
  );
}

// Function to fetch user inscriptions from Unisat API
async function fetchUserInscriptions(address: string): Promise<UnisatInscription[]> {
  const apiKey = process.env.NEXT_PUBLIC_UNISAT_API_KEY || 'YOUR_API_KEY_HERE';
  
  try {
    const response = await fetch(
      `https://open-api.unisat.io/v1/indexer/address/${address}/inscription-data?cursor=0&size=100`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data: UnisatApiResponse = await response.json();
    
    if (data.code !== 0) {
      throw new Error(`API Error: ${data.msg}`);
    }

    return data.data.inscription || [];
  } catch (error) {
    console.error('Error fetching inscriptions:', error);
    return [];
  }
}

// Function to load magic mints data
async function loadMagicMints(): Promise<MagicMint[]> {
  try {
    const response = await fetch('/first_mints_per_index.json');
    if (!response.ok) {
      throw new Error('Failed to load magic mints data');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading magic mints:', error);
    return [];
  }
}

// Function to load blocks data
async function loadBlocks(): Promise<Block[]> {
  try {
    const response = await fetch('/blocks_with_21e8.json');
    if (!response.ok) {
      throw new Error('Failed to load blocks data');
    }
    const data = await response.json();
    return data.sort((a: Block, b: Block) => b.height - a.height); // Latest first
  } catch (error) {
    console.error('Error loading blocks:', error);
    return [];
  }
}

// Function to load cached mints data  
async function loadCachedMints(): Promise<CachedMintData[]> {
  try {
    const response = await fetch('/first_mints_per_index.json');
    if (!response.ok) {
      throw new Error('Failed to load cached mints data');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading cached mints:', error);
    return [];
  }
}

// Function to get user's magic blocks
async function getUserMagicBlocks(address: string): Promise<{ count: number; blocks: Block[]; cachedMints: CachedMintData[] }> {
  try {
    const [userInscriptions, magicMints, allBlocks, cachedMints] = await Promise.all([
      fetchUserInscriptions(address),
      loadMagicMints(),
      loadBlocks(),
      loadCachedMints()
    ]);

    // Create a Set of magic inscription IDs for fast lookup
    const magicInscriptionIds = new Set(
      magicMints
        .filter(mint => mint.found)
        .map(mint => mint.inscriptionId)
    );

    // Filter user's inscriptions to get only magic tokens
    const userMagicMints = userInscriptions.filter(inscription => 
      magicInscriptionIds.has(inscription.inscriptionId)
    );

    // Get the block indices for user's magic tokens
    const userBlockIndices = new Set(
      userMagicMints.map(inscription => {
        const magicMint = magicMints.find(mint => mint.inscriptionId === inscription.inscriptionId);
        return magicMint?.index;
      }).filter(index => index !== undefined)
    );

    // Filter blocks to only show blocks containing user's magic tokens
    const userMagicBlocks = allBlocks.filter(block => userBlockIndices.has(block.index));

    return {
      count: userMagicMints.length,
      blocks: userMagicBlocks,
      cachedMints: cachedMints
    };
  } catch (error) {
    console.error('Error getting user magic blocks:', error);
    return { count: 0, blocks: [], cachedMints: [] };
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function WalletView({ address, onBack }: WalletViewProps) {
  const [magicCount, setMagicCount] = useState<number | null>(null);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [userBlocks, setUserBlocks] = useState<Block[]>([]);
  const [cachedMints, setCachedMints] = useState<CachedMintData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const swiperRef = useRef<any>(null);

  const handleCheckMagic = async () => {
    if (!address) return;
    
    setLoadingMagic(true);
    setError(null);
    
    try {
      const { count, blocks, cachedMints } = await getUserMagicBlocks(address);
      setMagicCount(count);
      setUserBlocks(blocks);
      setCachedMints(cachedMints);
      setHasChecked(true);
    } catch (e: any) {
      setError(`Failed to fetch magic tokens: ${e.message}`);
    } finally {
      setLoadingMagic(false);
    }
  };

  const handleSlideChange = (swiper: any) => {
    setCurrentSlideIndex(swiper.activeIndex);
  };

  const handlePrevious = () => {
    if (swiperRef.current) {
      swiperRef.current.slidePrev();
    }
  };

  const handleNext = () => {
    if (swiperRef.current) {
      swiperRef.current.slideNext();
    }
  };

  const handleCopyAddress = async () => {
    try {
      await copyToClipboard(address);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  const handleCopyInscription = (inscriptionId: string) => {
    copyToClipboard(inscriptionId);
  };

  const getMintForBlock = (blockIndex: number): CachedMintData | undefined => {
    return cachedMints.find(mint => mint.index === blockIndex);
  };

  const shortenAddress = (addr: string, chars = 6) => {
    if (addr.length <= chars * 2) return addr;
    return `${addr.substring(0, chars)}...${addr.substring(addr.length - chars)}`;
  };

  // Auto-check magic tokens on component mount
  useEffect(() => {
    if (address && !hasChecked) {
      handleCheckMagic();
    }
  }, [address]);

  const isAtFirst = currentSlideIndex === 0;
  const isAtLast = currentSlideIndex === userBlocks.length - 1;

  return (
    <>
      {/* Back button and refresh button */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="bg-black/10 backdrop-blur-md text-white px-4 py-2 border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer font-mono text-sm font-medium shadow-lg"
        >
          ← Back
        </button>

        <button
          onClick={handleCheckMagic}
          disabled={loadingMagic}
          className="bg-black/10 backdrop-blur-md text-white px-4 py-2 border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer font-mono text-sm font-medium shadow-lg disabled:opacity-50 flex items-center justify-center"
        >
          {loadingMagic ? (
            <div className="animate-spin h-4 w-4 border border-white border-t-transparent rounded-full"></div>
          ) : (
            'Refresh'
          )}
        </button>
      </div>

      {/* Large centered clickable address */}
      <div className="text-center mb-8">
        <div 
          onClick={handleCopyAddress}
          className="text-white font-mono text-xl md:text-2xl lg:text-3xl max-w-4xl mx-auto cursor-pointer hover:text-white/80 transition-colors duration-200 px-4"
          title="Click to copy full address"
        >
          {shortenAddress(address)}
        </div>
        
        {/* Magic token count - show after check is complete */}
        {hasChecked && (
          <div className="text-white/70 text-sm mt-2">
            {magicCount === 0 ? 'No $magic mints found' : `${magicCount} $magic mints found`}
          </div>
        )}
      </div>

      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-4 right-4 bg-green-500/90 backdrop-blur-md text-white px-4 py-2 border border-green-400/20 shadow-lg z-50 transition-all duration-200">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span className="text-sm font-medium">Address copied to clipboard!</span>
          </div>
        </div>
      )}



      {/* Loading State */}
      {loadingMagic && !hasChecked && (
        <div className="text-center py-16">
          <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-white/70 text-sm">Finding your $magic mints...</div>
        </div>
      )}

      {/* No Magic Tokens */}
      {hasChecked && magicCount === 0 && (
        <div className="text-center py-16">
          <div className="text-white/70 text-lg mb-2">No $magic mints found</div>
          <div className="text-white/50 text-sm">This wallet doesn't own any $magic mints.</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/20 p-4 text-center mb-8">
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      )}

      

      {/* User's Magic Blocks Swiper */}
      {userBlocks.length > 0 && (
        <div className="relative px-4 pt-2">
          <Swiper
            modules={[Pagination]}
            spaceBetween={32}
            slidesPerView={1}
            pagination={{
              clickable: true,
              dynamicBullets: true,
            }}
            breakpoints={{
              640: {
                slidesPerView: 1,
                spaceBetween: 24,
              },
              768: {
                slidesPerView: 2,
                spaceBetween: 32,
              },
              1024: {
                slidesPerView: 3,
                spaceBetween: 32,
              },
            }}
            className="!pb-16"
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
            }}
            onSlideChange={handleSlideChange}
          >
            {userBlocks.map((block) => {
              const mint = getMintForBlock(block.index);
              
              return (
                <SwiperSlide key={block.index}>
                  {/* Index outside card */}
                  <div className="text-center mb-4 mt-4">
                    <span className="bg-black/10 backdrop-blur-md text-white text-lg font-bold px-3 py-1.5 border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer shadow-lg">
                      #{block.index}
                    </span>
                  </div>
                  
                  <div className="bg-black/10 backdrop-blur-md text-white p-6 border border-white/20 hover:bg-white/90 hover:text-black hover:outline hover:outline-2 hover:outline-black transition-all duration-200 h-full flex flex-col cursor-pointer group shadow-lg">
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold mb-2">
                        Block {block.height.toLocaleString()}
                      </h3>
                      
                      <div className="bg-black/10 backdrop-blur-md group-hover:bg-white/90 p-3 border border-white/20 mb-3 group-hover:outline group-hover:outline-2 group-hover:outline-black transition-all duration-200">
                        <div className="text-xs opacity-70 mb-1 text-white group-hover:text-black transition-colors duration-200">Hash:</div>
                        <div className="group-hover:text-black transition-colors duration-200">
                          <HighlightedHash hash={block.hash} />
                        </div>
                      </div>

                      {/* Inscription Info */}
                      {mint && mint.found ? (
                        <div className="bg-black/10 backdrop-blur-md group-hover:bg-white/90 p-3 border border-white/20 group-hover:outline group-hover:outline-2 group-hover:outline-black transition-all duration-200 h-20 flex flex-col justify-center">
                          <div className="text-xs opacity-70 mb-1 text-white group-hover:text-black transition-colors duration-200">Inscription Number:</div>
                          <div className="flex items-center justify-between">
                            <span className="bg-black/10 backdrop-blur-md group-hover:bg-white/90 text-white group-hover:text-black px-2 py-1 text-xs font-medium transition-all duration-200">
                              #{parseInt(mint.inscriptionNumber || '0').toLocaleString()}
                            </span>
                            <a 
                              href={`https://magiceden.us/ordinals/item-details/${mint.inscriptionId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium hover:underline transition-colors opacity-70 hover:opacity-100 text-white group-hover:text-black"
                            >
                              View →
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-black/10 backdrop-blur-md group-hover:bg-white/90 p-3 border border-white/20 group-hover:outline group-hover:outline-2 group-hover:outline-black transition-all duration-200 h-20 flex flex-col justify-center">
                          <div className="text-xs opacity-70 text-center text-white group-hover:text-black transition-colors duration-200">Magic token found but not cached</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Timestamp at bottom */}
                    <div className="text-center mt-auto pt-4 border-t border-white group-hover:border-black transition-colors duration-200">
                      <span className="text-sm opacity-70">
                        {formatDate(block.time)}
                      </span>
                    </div>
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
          
          {/* Previous Button - Only show if not at first slide */}
          {!isAtFirst && (
            <div 
              onClick={handlePrevious}
              className="swiper-button-prev-custom absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/10 backdrop-blur-md hover:bg-white/90 border border-white/20 flex items-center justify-center cursor-pointer transition-all duration-200 z-10 shadow-lg group"
            >
              <svg className="w-6 h-6 text-white group-hover:text-black transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          )}
          
          {/* Next Button - Only show if not at last slide */}
          {!isAtLast && (
            <div 
              onClick={handleNext}
              className="swiper-button-next-custom absolute -right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/10 backdrop-blur-md hover:bg-white/90 border border-white/20 flex items-center justify-center cursor-pointer transition-all duration-200 z-10 shadow-lg group"
            >
              <svg className="w-6 h-6 text-white group-hover:text-black transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </div>
      )}
    </>
  );
} 