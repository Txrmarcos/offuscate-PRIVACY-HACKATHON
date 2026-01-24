/**
 * Setup Relayer Script
 *
 * Creates a new relayer keypair and funds it on devnet.
 * The relayer pays gas for privacy pool withdrawals so stealth addresses
 * don't appear as fee payers.
 *
 * Usage:
 *   npx ts-node scripts/setup-relayer.ts
 *
 * After running, add the output to your .env file:
 *   RELAYER_SECRET_KEY=<base58_key>
 */

import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';

const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';

async function main() {
  console.log('\n===========================================');
  console.log('       RELAYER SETUP SCRIPT');
  console.log('===========================================\n');

  // Check if relayer already exists
  const relayerPath = path.join(__dirname, '..', 'relayer.json');
  let keypair: Keypair;

  if (fs.existsSync(relayerPath)) {
    console.log('Found existing relayer.json, loading...');
    const data = JSON.parse(fs.readFileSync(relayerPath, 'utf-8'));
    keypair = Keypair.fromSecretKey(Uint8Array.from(data));
  } else {
    console.log('Generating new relayer keypair...');
    keypair = Keypair.generate();

    // Save to file
    fs.writeFileSync(
      relayerPath,
      JSON.stringify(Array.from(keypair.secretKey))
    );
    console.log(`Saved to: ${relayerPath}`);
  }

  const publicKey = keypair.publicKey.toString();
  const secretKeyBase58 = bs58.encode(keypair.secretKey);

  console.log('\n--- RELAYER INFO ---');
  console.log(`Public Key:  ${publicKey}`);
  console.log(`Secret Key (base58): ${secretKeyBase58.slice(0, 20)}...${secretKeyBase58.slice(-10)}`);

  // Check balance
  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`Balance:     ${balance / LAMPORTS_PER_SOL} SOL`);

  // Airdrop if needed
  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log('\nBalance low, requesting airdrop...');
    try {
      const sig = await connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig);
      const newBalance = await connection.getBalance(keypair.publicKey);
      console.log(`New balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);
    } catch (err: any) {
      console.log('Airdrop failed (rate limited?). Fund manually:');
      console.log(`  solana airdrop 2 ${publicKey} --url devnet`);
    }
  }

  console.log('\n--- ADD TO .env FILE ---');
  console.log(`RELAYER_SECRET_KEY=${secretKeyBase58}`);

  console.log('\n--- VERIFY SETUP ---');
  console.log('After adding to .env, verify with:');
  console.log('  curl http://localhost:3000/api/relayer/claim');

  console.log('\n===========================================\n');
}

main().catch(console.error);
