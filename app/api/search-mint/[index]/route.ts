import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

interface BlockData {
  index: number;
  height: number;
  hash: string;
  time: number;
}

interface InscriptionResult {
  inscriptionId: string;
  inscriptionNumber: number;
  blockHeight: number;
  txid: string;
  currentOwner?: string;
  genesisOwner?: string;
  contentStr?: string;
}

function httpsGet(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000);
  });
}

function isValidMagicMint(contentStr: string, targetBlockHeight: number): boolean {
  try {
    const content = JSON.parse(contentStr);
    
    // Check if it matches the exact pattern
    const expectedPattern = {
      "p": "tap",
      "op": "dmt-mint",
      "dep": "cddb01f87428f8efa89664e08e248595e20c90432a28839e1c62b357afa756e1i0",
      "tick": "magic",
      "blk": targetBlockHeight.toString()
    };
    
    // Compare each field - the JSON parser handles spacing automatically
    return (
      content.p === expectedPattern.p &&
      content.op === expectedPattern.op &&
      content.dep === expectedPattern.dep &&
      content.tick === expectedPattern.tick &&
      content.blk === expectedPattern.blk
    );
  } catch (error) {
    // If JSON parsing fails, it doesn't match
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ index: string }> }
) {
  try {
    const { index: indexParam } = await params;
    const index = parseInt(indexParam);
    
    // Load blocks data
    const blocksResponse = await fetch(`${request.nextUrl.origin}/blocks_with_21e8.json`);
    const blocks: BlockData[] = await blocksResponse.json();
    
    const block = blocks.find(b => b.index === index);
    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    const blockHeight = block.height;
    
    // Search patterns for both formats
    const patterns = [
      `"blk":"${blockHeight}"`,
      `"blk": "${blockHeight}"`
    ];
    
    console.log(`Searching for block index ${index}, height ${blockHeight}`);
    console.log(`Search patterns:`, patterns);
    
    const results: InscriptionResult[] = [];
    const ORDINALS_API_KEY = process.env.ORDINALS_API_KEY;
    const ORDISCAN_API_KEY = process.env.ORDISCAN_API_KEY;
    
    if (!ORDINALS_API_KEY || !ORDISCAN_API_KEY) {
      return NextResponse.json(
        { error: 'Missing required API keys in environment variables' }, 
        { status: 500 }
      );
    }
    
    for (const pattern of patterns) {
      try {
        const url = `https://api.ordinalsbot.com/search?text=${encodeURIComponent(pattern)}`;
        console.log(`Searching URL: ${url}`);
        
        const searchResults = await httpsGet(url, {
          'x-api-key': ORDINALS_API_KEY,
          'Accept': 'application/json'
        });
        
        console.log(`Search results for pattern "${pattern}":`, searchResults);
        
        if (searchResults?.results?.length > 0) {
          for (const result of searchResults.results) {
            // Verify this is a magic mint by checking the exact pattern
            if (result.contentstr && isValidMagicMint(result.contentstr, blockHeight)) {
              
              console.log('Found matching mint:', {
                inscriptionid: result.inscriptionid,
                inscriptionnumber: result.inscriptionnumber,
                txid: result.txid,
                contentstr: result.contentstr
              });
              
              let currentOwner, genesisOwner;
              
              // Get owner info and inscription number from Ordiscan
              let inscriptionNumber = 0;
              try {
                const ordiscanUrl = `https://api.ordiscan.com/v1/inscription/${result.inscriptionid}`;
                const ownerData = await httpsGet(ordiscanUrl, {
                  'Authorization': `Bearer ${ORDISCAN_API_KEY}`,
                  'Accept': 'application/json'
                });
                
                console.log('Ordiscan API response:', ownerData);
                
                currentOwner = ownerData?.data?.owner_address;
                genesisOwner = ownerData?.data?.genesis_address;
                
                // Try to get inscription number from Ordiscan
                if (ownerData?.data?.inscription_number) {
                  inscriptionNumber = parseInt(ownerData.data.inscription_number);
                } else if (ownerData?.data?.num) {
                  inscriptionNumber = parseInt(ownerData.data.num);
                }
              } catch (e) {
                console.log('Owner lookup failed:', e);
              }
              
              // Fallback: try to parse from OrdinalsBot result if available
              if (inscriptionNumber === 0 && result.inscriptionnumber) {
                if (typeof result.inscriptionnumber === 'string') {
                  inscriptionNumber = parseInt(result.inscriptionnumber);
                } else if (typeof result.inscriptionnumber === 'number') {
                  inscriptionNumber = result.inscriptionnumber;
                }
              }
              
              console.log('Final inscription number:', inscriptionNumber);
              
              results.push({
                inscriptionId: result.inscriptionid,
                inscriptionNumber: inscriptionNumber,
                blockHeight: blockHeight,
                txid: result.txid,
                currentOwner,
                genesisOwner,
                contentStr: result.contentstr
              });
            }
          }
        }
        
        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error searching pattern ${pattern}:`, error);
      }
    }
    
    // Sort by inscription number (lowest first)
    results.sort((a, b) => a.inscriptionNumber - b.inscriptionNumber);
    
    return NextResponse.json({
      block: {
        index: block.index,
        height: block.height,
        hash: block.hash,
        time: block.time
      },
      mints: results,
      count: results.length
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to search mint information' }, 
      { status: 500 }
    );
  }
} 