'use client';

import { useState, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import Spline from '@splinetool/react-spline';
import WalletConnect from './WalletConnect';
import WalletView from './WalletView';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

// Three.js ASCII Effect Component
function AsciiEffect() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);

  useEffect(() => {
    let camera: any, controls: any, scene: any, renderer: any, effect: any;
    let sphere: any, plane: any;
    let animationId: number;
    
    const start = Date.now();

    async function init() {
      if (!mountRef.current) return;

      // Dynamically import Three.js modules
      const THREE = await import('three');
      const { AsciiEffect } = await import('three/examples/jsm/effects/AsciiEffect.js');
      const { TrackballControls } = await import('three/examples/jsm/controls/TrackballControls.js');

      camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
      camera.position.y = 150;
      camera.position.z = 500;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0, 0, 0);

      const pointLight1 = new THREE.PointLight(0xffffff, 3, 0, 0);
      pointLight1.position.set(500, 500, 500);
      scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(0xffffff, 1, 0, 0);
      pointLight2.position.set(-500, -500, -500);
      scene.add(pointLight2);

      sphere = new THREE.Mesh(
        new THREE.SphereGeometry(200, 20, 10),
        new THREE.MeshPhongMaterial({ flatShading: true })
      );
      scene.add(sphere);

      // Plane
      plane = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400),
        new THREE.MeshBasicMaterial({ color: 0xe0e0e0 })
      );
      plane.position.y = -200;
      plane.rotation.x = -Math.PI / 2;
      scene.add(plane);

      renderer = new THREE.WebGLRenderer();
      renderer.setSize(window.innerWidth, window.innerHeight);

      effect = new AsciiEffect(renderer, ' 21e8', { invert: true });
      effect.setSize(window.innerWidth, window.innerHeight);
      effect.domElement.style.color = '#00ff41';
      effect.domElement.style.backgroundColor = '#000000';
      effect.domElement.style.textShadow = '0 0 5px #00ff41, 0 0 10px #00ff41, 0 0 15px #00ff41';
      effect.domElement.style.fontFamily = 'monospace';
      effect.domElement.style.position = 'fixed';
      effect.domElement.style.top = '0';
      effect.domElement.style.left = '0';
      effect.domElement.style.zIndex = '0';

      mountRef.current.appendChild(effect.domElement);

      controls = new TrackballControls(camera, effect.domElement);

      sceneRef.current = { camera, controls, scene, renderer, effect, sphere, plane, start };

      animate();
    }

    function animate() {
      if (!sceneRef.current) return;
      
      const { camera, controls, scene, renderer, effect, sphere, start } = sceneRef.current;
      const timer = Date.now() - start;

      sphere.position.y = Math.abs(Math.sin(timer * 0.002)) * 150;
      sphere.rotation.x = timer * 0.0003;
      sphere.rotation.z = timer * 0.0002;

      controls.update();
      effect.render(scene, camera);

      animationId = requestAnimationFrame(animate);
    }

    function onWindowResize() {
      if (!sceneRef.current) return;
      
      const { camera, renderer, effect } = sceneRef.current;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      effect.setSize(window.innerWidth, window.innerHeight);
    }

    init();

    window.addEventListener('resize', onWindowResize);

    return () => {
      window.removeEventListener('resize', onWindowResize);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (mountRef.current && sceneRef.current) {
        const { effect } = sceneRef.current;
        if (effect && effect.domElement && mountRef.current.contains(effect.domElement)) {
          mountRef.current.removeChild(effect.domElement);
        }
      }
    };
  }, []);

  return <div ref={mountRef} className="fixed inset-0 w-full h-full" />;
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

interface SearchResult {
  inscriptionId: string;
  inscriptionNumber: number;
  blockHeight: number;
  txid: string;
  currentOwner?: string;
  genesisOwner?: string;
  contentStr?: string;
}

interface SearchState {
  [blockIndex: number]: {
    loading: boolean;
    result?: SearchResult;
    searched: boolean;
  };
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

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function TradeSection() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedMints, setCachedMints] = useState<CachedMintData[]>([]);
  const [searchStates, setSearchStates] = useState<SearchState>({});
  const [blocksHidden, setBlocksHidden] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showWalletView, setShowWalletView] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [btcPrice, setBtcPrice] = useState<number>(0);
  const [useAsciiEffect, setUseAsciiEffect] = useState(false);

  const swiperRef = useRef<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Load blocks data
        const blocksResponse = await fetch('/blocks_with_21e8.json');
        if (!blocksResponse.ok) {
          throw new Error('Failed to load blocks data');
        }
        const blocksData: Block[] = await blocksResponse.json();
        
        // Sort by block height descending (latest first)
        const sortedBlocks = blocksData.sort((a, b) => b.height - a.height);
        setBlocks(sortedBlocks);

        // Load cached mint data
        const mintsResponse = await fetch('/first_mints_per_index.json');
        if (mintsResponse.ok) {
          const mintsData: CachedMintData[] = await mintsResponse.json();
          setCachedMints(mintsData);
        }

        // Fetch BTC price using multiple fallback APIs
        const fetchBTCPrice = async () => {
          const apis = [
            {
              url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
              parser: (data: any) => data.bitcoin.usd
            },
            {
              url: 'https://api.coinbase.com/v2/exchange-rates?currency=BTC',
              parser: (data: any) => parseFloat(data.data.rates.USD)
            },
            {
              url: 'https://api.blockchain.info/ticker',
              parser: (data: any) => data.USD.last
            }
          ];

          for (const api of apis) {
            try {
              console.log('Trying API:', api.url);
              const response = await fetch(api.url);
              if (response.ok) {
                const data = await response.json();
                const price = api.parser(data);
                console.log('BTC Price fetched from', api.url, ':', price);
                setBtcPrice(price);
                return;
              }
            } catch (err) {
              console.error('API failed:', api.url, err);
            }
          }
          
          // If all APIs fail, use fallback
          console.log('All APIs failed, using fallback price');
          setBtcPrice(100000);
        };

        await fetchBTCPrice();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const getMintForBlock = (blockIndex: number): CachedMintData | undefined => {
    return cachedMints.find(mint => mint.index === blockIndex);
  };

  const searchForMint = async (blockIndex: number) => {
    setSearchStates(prev => ({
      ...prev,
      [blockIndex]: { loading: true, searched: false }
    }));

    try {
      const response = await fetch(`/api/search-mint/${blockIndex}`);
      
      if (!response.ok) {
        throw new Error('Failed to search for mint');
      }
      
      const result = await response.json();
      
      setSearchStates(prev => ({
        ...prev,
        [blockIndex]: {
          loading: false,
          result: result.mints?.[0] || null,
          searched: true
        }
      }));
    } catch (err) {
      console.error('Search error:', err);
      setSearchStates(prev => ({
        ...prev,
        [blockIndex]: {
          loading: false,
          searched: true
        }
      }));
    }
  };

  const handleFastReverse = () => {
    if (swiperRef.current) {
      const currentIndex = swiperRef.current.activeIndex;
      const newIndex = Math.max(0, currentIndex - 100);
      swiperRef.current.slideTo(newIndex);
    }
  };

  const handleFastSkip = () => {
    if (swiperRef.current) {
      const currentIndex = swiperRef.current.activeIndex;
      const newIndex = Math.min(blocks.length - 1, currentIndex + 100);
      swiperRef.current.slideTo(newIndex);
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

  const handleWalletView = (address: string) => {
    setWalletAddress(address);
    setShowWalletView(true);
  };

  const handleBackToBlocks = () => {
    setShowWalletView(false);
    setWalletAddress('');
  };



  // Calculate market cap: 0.002 BTC * 644 * BTC price in USD
  const floorPrice = 0.002;
  const totalSupply = 644;
  const marketCap = btcPrice > 0 ? floorPrice * totalSupply * btcPrice : 0;
  
  // Debug logging
  console.log('Market cap calculation:', { floorPrice, totalSupply, btcPrice, marketCap });

  const isAtFirst = currentSlideIndex === 0;
  const isAtLast = currentSlideIndex === blocks.length - 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8 font-mono">
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border border-white border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-white">Loading Bitcoin blocks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded backdrop-blur-sm">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-black p-4 sm:p-8 font-mono">
      {/* Background Effects */}
      {useAsciiEffect ? (
        <AsciiEffect />
      ) : (
        <div className="fixed inset-0 w-full h-full z-0">
          <Spline
            scene="https://prod.spline.design/nLQdkzIe4ittYQFZ/scene.splinecode" 
          />
        </div>
      )}
      
      {/* Content overlay */}
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header with Title and Wallet */}
        <div className="relative flex flex-col sm:flex-row items-center justify-center mb-8 gap-4">
          {/* Title - Centered */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
              <a 
                href="https://magiceden.us/ordinals/marketplace/magic" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-black text-white px-3 py-1 border border-white hover:bg-white hover:text-black transition-colors duration-200"
              >
                $magic
              </a>
            </h1>
          </div>
          
          {/* Wallet Connect - Absolute positioned to right - Hidden on mobile */}
          <div className="hidden sm:flex sm:absolute sm:right-0 sm:top-0 w-full sm:w-auto sm:max-w-xs items-center gap-2">
            {/* Background Toggle Button */}
            <button
              onClick={() => setUseAsciiEffect(!useAsciiEffect)}
              className="bg-black/10 backdrop-blur-md text-white px-2 py-2 border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer text-xs shadow-lg"
              title={useAsciiEffect ? "Switch to Spline" : "Switch to ASCII"}
            >
              {useAsciiEffect ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6m-3-3v6" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
            </button>
            
            {/* Hide/Show Button - Left of connect button */}
            <button
              onClick={() => setBlocksHidden(!blocksHidden)}
              className="bg-black/10 backdrop-blur-md text-white px-2 py-2 border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer text-xs shadow-lg"
              title={blocksHidden ? "Show blocks" : "Hide blocks"}
            >
              {blocksHidden ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L12 12m-3.172-3.172l-1.414-1.414M12 12l3.172-3.172m0 0l1.414-1.414M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            
            <WalletConnect onWalletView={handleWalletView} />
          </div>
        </div>

        {/* Conditional Content */}
        {showWalletView ? (
          <WalletView address={walletAddress} onBack={handleBackToBlocks} />
        ) : (
          <div className={`transition-all duration-500 ease-in-out ${blocksHidden ? 'opacity-0 max-h-0 overflow-hidden' : 'opacity-100 max-h-full'}`}>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <a
              href="https://magiceden.us/ordinals/marketplace/magic"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="bg-black/10 backdrop-blur-md text-white p-4 border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer shadow-lg">
                <div className="text-2xl font-bold">{blocks.length}</div>
                <div className="text-sm opacity-70">Total Blocks</div>
              </div>
            </a>
            <a
              href="https://magiceden.us/ordinals/marketplace/magic"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="bg-black/10 backdrop-blur-md text-white p-4 border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer shadow-lg">
                <div className="text-2xl font-bold">
                  {blocks.length > 0 ? blocks[0].height.toLocaleString() : 0}
                </div>
                <div className="text-sm opacity-70">Latest Height</div>
              </div>
            </a>
            <a
              href="https://magiceden.us/ordinals/marketplace/magic"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="bg-black/10 backdrop-blur-md text-white p-4 border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer shadow-lg">
                <div className="text-2xl font-bold">
                  {btcPrice === 0 ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin h-5 w-5 border border-white border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    `$${Math.round(marketCap).toLocaleString()}`
                  )}
                </div>
                <div className="text-sm opacity-70">Market Cap</div>
              </div>
            </a>
            <a
              href="https://magiceden.us/ordinals/marketplace/magic"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="bg-black/10 backdrop-blur-md text-white p-4 border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer shadow-lg">
                <div className="text-2xl font-bold">200,000 sats</div>
                <div className="text-sm opacity-70">Floor</div>
              </div>
            </a>
          </div>

          {/* Blocks Swiper */}
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
            {blocks.map((block) => {
              const mint = getMintForBlock(block.index);
              
              return (
                <SwiperSlide key={block.index}>
                  {/* Index outside card */}
                  <div className="text-center mb-4 mt-4">
                    <span className="bg-black/10 backdrop-blur-md text-white text-lg font-bold px-3 py-1.5 border border-white/20 hover:bg-white/90 hover:text-black transition-all duration-200 cursor-pointer shadow-lg">
                      #{block.index}
                    </span>
                  </div>
                  
                  <div className="bg-black/10 backdrop-blur-md text-white p-6 border border-white/20 hover:bg-white/90 hover:text-black hover:outline hover:outline-2 hover:outline-black transition-all duration-200 h-full flex flex-col group shadow-lg"
                  >
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
                  ) : searchStates[block.index]?.result ? (
                    <div className="bg-black/10 backdrop-blur-md group-hover:bg-white/90 p-3 border border-white/20 group-hover:outline group-hover:outline-2 group-hover:outline-black transition-all duration-200 h-20 flex flex-col justify-center">
                      <div className="text-xs opacity-70 mb-1 text-white group-hover:text-black transition-colors duration-200">Inscription Number:</div>
                      <div className="flex items-center justify-between">
                        <span className="bg-black/10 backdrop-blur-md group-hover:bg-white/90 text-white group-hover:text-black px-2 py-1 text-xs font-medium transition-all duration-200">
                          #{searchStates[block.index].result!.inscriptionNumber.toLocaleString()}
                        </span>
                        <a 
                          href={`https://magiceden.us/ordinals/item-details/${searchStates[block.index].result!.inscriptionId}`}
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
                      {searchStates[block.index]?.loading ? (
                        <div className="flex items-center justify-center py-2">
                          <div className="animate-spin h-4 w-4 border border-white group-hover:border-black border-t-transparent rounded-full transition-colors duration-200"></div>
                          <span className="text-xs opacity-70 ml-2 text-white group-hover:text-black transition-colors duration-200">Searching...</span>
                        </div>
                      ) : searchStates[block.index]?.searched ? (
                        <div className="text-xs opacity-70 text-center text-white group-hover:text-black transition-colors duration-200">No mint found</div>
                      ) : (
                        <div className="flex items-center justify-center pt-4">
                          <button
                            onClick={() => searchForMint(block.index)}
                            className="bg-black/10 backdrop-blur-md group-hover:bg-white/90 text-white group-hover:text-black px-3 py-1 text-xs font-medium transition-all duration-200"
                          >
                            Search for Mint
                          </button>
                        </div>
                      )}
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
          
          {/* Fast Reverse Button - Only show if not at first slide */}
          {!isAtFirst && (
            <div 
              onClick={handleFastReverse}
              className="swiper-button-fast-reverse-custom absolute -left-20 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/10 backdrop-blur-md hover:bg-white/90 border border-white/20 flex items-center justify-center cursor-pointer transition-all duration-200 z-10 shadow-lg group"
            >
              <svg className="w-6 h-6 text-white group-hover:text-black transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </div>
          )}
          
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
          
          {/* Fast Skip Button - Only show if not at last slide */}
          {!isAtLast && (
            <div 
              onClick={handleFastSkip}
              className="swiper-button-fast-skip-custom absolute -right-20 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/10 backdrop-blur-md hover:bg-white/90 border border-white/20 flex items-center justify-center cursor-pointer transition-all duration-200 z-10 shadow-lg group"
            >
              <svg className="w-6 h-6 text-white group-hover:text-black transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m13 5 7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </div>
          )}
          </div>
          </div>
        )}

        {/* Footer */}


       
      </div>
    </div>
  );
} 