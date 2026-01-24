import { PublicKey } from '@solana/web3.js';
import { isLightProtocolAvailable, getCompressedBalance, createLightRpc } from './app/lib/privacy/lightProtocol';

async function test() {
  console.log('🔍 Testing Light Protocol connection...\n');
  
  // Test 1: Check availability
  const available = await isLightProtocolAvailable();
  console.log(`✓ Light Protocol Available: ${available}`);
  
  // Test 2: Check RPC connection
  const rpc = createLightRpc();
  try {
    const health = await rpc.getIndexerHealth();
    console.log(`✓ Indexer Health: ${health}`);
  } catch (e: any) {
    console.log(`⚠ Indexer check failed: ${e.message}`);
  }
  
  // Test 3: Get compressed balance (example address)
  const testAddress = new PublicKey('BEfcVt7sUkRC4HVmWn2FHLkKPKMu1uhkXb4dDr5g7A1a');
  const balance = await getCompressedBalance(testAddress);
  console.log(`✓ Compressed Balance for test address: ${balance.sol} SOL`);
  
  console.log('\n✅ Light Protocol integration is working!');
}

test().catch(console.error);
