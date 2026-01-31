/**
 * Light Protocol Integration for ZK Compressed Privacy Donations
 *
 * Uses Light Protocol's ZK Compression for truly private transfers on Solana.
 * Compressed SOL transactions use zero-knowledge proofs (Groth16) to hide
 * transaction details while maintaining on-chain verifiability.
 *
 * Privacy Features:
 * - Compressed SOL breaks the link between sender and receiver
 * - ZK proofs verify correctness without revealing details
 * - State stored in Merkle trees with only roots on-chain
 * - 99% reduction in on-chain footprint
 *
 * @see https://zkcompression.com
 * @see https://github.com/Lightprotocol/light-protocol
 */

import {
  Rpc,
  createRpc,
  LightSystemProgram,
  bn,
  buildTx,
  sendAndConfirmTx,
  defaultStateTreeLookupTables,
  getAllStateTreeInfos,
  selectStateTreeInfo,
  type TreeInfo,
} from '@lightprotocol/stateless.js';
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  ComputeBudgetProgram,
  TransactionInstruction,
  Connection,
} from '@solana/web3.js';
import {
  calculateRelayerFee,
  type FeeBreakdown,
} from '../config/relayerFees';

// ============================================================================
// Types
// ============================================================================

export interface LightProtocolConfig {
  rpcUrl: string;
  compressionUrl?: string;
  proverUrl?: string;
}

export interface CompressResult {
  success: boolean;
  signature?: string;
  compressedAmount?: number;
  error?: string;
}

export interface TransferResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface DecompressResult {
  success: boolean;
  signature?: string;
  decompressedAmount?: number;
  error?: string;
}

export interface CompressedBalance {
  lamports: number;
  sol: number;
}

export interface LightWallet {
  publicKey: PublicKey;
  signTransaction: <T extends VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions?: <T extends VersionedTransaction>(txs: T[]) => Promise<T[]>;
}

// ============================================================================
// Configuration
// ============================================================================

let cachedTreeInfos: TreeInfo[] | null = null;

/**
 * Get Light Protocol RPC endpoints for devnet
 * Uses Helius as the ZK Compression RPC provider
 */
function getDevnetEndpoints(): LightProtocolConfig {
  const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';

  if (heliusKey) {
    const baseUrl = `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
    return {
      rpcUrl: baseUrl,
      compressionUrl: baseUrl,
      proverUrl: baseUrl,
    };
  }

  // Fallback to public devnet (may have rate limits)
  return {
    rpcUrl: 'https://api.devnet.solana.com',
    compressionUrl: 'https://devnet.helius-rpc.com',
    proverUrl: 'https://devnet.helius-rpc.com',
  };
}

/**
 * Create Light Protocol RPC connection
 */
export function createLightRpc(config?: LightProtocolConfig): Rpc {
  const endpoints = config || getDevnetEndpoints();

  return createRpc(
    endpoints.rpcUrl,
    endpoints.compressionUrl || endpoints.rpcUrl,
    endpoints.proverUrl || endpoints.rpcUrl
  );
}

/**
 * Get state tree infos for devnet
 * These are used to select which Merkle tree to write compressed accounts to
 */
async function getStateTreeInfos(connection: Rpc): Promise<TreeInfo[]> {
  if (cachedTreeInfos) {
    return cachedTreeInfos;
  }

  try {
    // Get devnet lookup tables
    const lookupTables = defaultStateTreeLookupTables().devnet;

    // Fetch all state tree infos from the lookup tables
    cachedTreeInfos = await getAllStateTreeInfos({
      connection: connection as unknown as Connection,
      stateTreeLUTPairs: lookupTables,
    });

    return cachedTreeInfos;
  } catch (error) {
    console.error('[LightProtocol] Failed to get state tree infos:', error);
    throw error;
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Compress SOL - Convert regular SOL to compressed SOL
 *
 * This breaks the direct link between your wallet and the compressed funds.
 * The compressed SOL is stored in a Merkle tree with only the root on-chain.
 *
 * @param wallet - User's wallet
 * @param amountSol - Amount in SOL to compress
 * @param recipientPubkey - Optional recipient (defaults to sender)
 * @returns CompressResult with transaction signature
 */
export async function compressSOL(
  wallet: LightWallet,
  amountSol: number,
  recipientPubkey?: PublicKey
): Promise<CompressResult> {
  try {
    console.log('[LightProtocol] Compressing', amountSol, 'SOL...');

    const connection = createLightRpc();
    const recipient = recipientPubkey || wallet.publicKey;
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    // Get state tree info for devnet
    const treeInfos = await getStateTreeInfos(connection);
    const outputStateTreeInfo = selectStateTreeInfo(treeInfos);

    console.log('[LightProtocol] Using state tree:', outputStateTreeInfo.tree.toBase58());

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Create compress instruction
    const compressIx = await LightSystemProgram.compress({
      payer: wallet.publicKey,
      toAddress: recipient,
      lamports: bn(lamports),
      outputStateTreeInfo,
    });

    // Add compute budget for ZK operations
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_000_000,
    });

    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    // Build versioned transaction with lookup tables (empty for now - Light handles internally)
    const instructions: TransactionInstruction[] = [
      computeBudgetIx,
      computePriceIx,
      compressIx,
    ];

    const tx = buildTx(instructions, wallet.publicKey, blockhash, []);

    // Sign with wallet adapter
    const signedTx = await wallet.signTransaction(tx);

    // Send and confirm
    const signature = await sendAndConfirmTx(connection, signedTx);

    console.log('[LightProtocol] Compress successful:', signature);

    return {
      success: true,
      signature,
      compressedAmount: amountSol,
    };
  } catch (error: any) {
    console.error('[LightProtocol] Compress error:', error);
    return {
      success: false,
      error: error.message || 'Failed to compress SOL',
    };
  }
}

/**
 * Transfer Compressed SOL - Send compressed SOL privately
 *
 * This is the core privacy transfer. The compressed SOL moves between
 * Merkle tree leaves without revealing the full transaction details.
 * Only the ZK proof and state root updates are on-chain.
 *
 * @param wallet - User's wallet (must own compressed SOL)
 * @param recipientPubkey - Destination address
 * @param amountSol - Amount in SOL to transfer
 * @returns TransferResult with transaction signature
 */
export async function transferCompressedSOL(
  wallet: LightWallet,
  recipientPubkey: PublicKey,
  amountSol: number
): Promise<TransferResult> {
  try {
    console.log('[LightProtocol] Transferring', amountSol, 'compressed SOL...');

    const connection = createLightRpc();
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    // Get compressed accounts owned by wallet
    const compressedAccounts = await connection.getCompressedAccountsByOwner(wallet.publicKey);

    if (!compressedAccounts.items || compressedAccounts.items.length === 0) {
      return {
        success: false,
        error: 'No compressed SOL found. Please compress some SOL first.',
      };
    }

    // Calculate total balance
    let totalLamports = BigInt(0);
    for (const account of compressedAccounts.items) {
      totalLamports += BigInt(account.lamports.toString());
    }

    if (totalLamports < BigInt(lamports)) {
      return {
        success: false,
        error: `Insufficient compressed balance. Have ${Number(totalLamports) / LAMPORTS_PER_SOL} SOL, need ${amountSol} SOL`,
      };
    }

    // Get validity proof for the compressed accounts
    const proof = await connection.getValidityProof(
      compressedAccounts.items.map(a => bn(a.hash))
    );

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Create transfer instruction
    const transferIx = await LightSystemProgram.transfer({
      payer: wallet.publicKey,
      toAddress: recipientPubkey,
      lamports: bn(lamports),
      inputCompressedAccounts: compressedAccounts.items,
      recentInputStateRootIndices: proof.rootIndices,
      recentValidityProof: proof.compressedProof,
    });

    // Add compute budget
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });

    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    // Build versioned transaction
    const instructions: TransactionInstruction[] = [
      computeBudgetIx,
      computePriceIx,
      transferIx,
    ];

    const tx = buildTx(instructions, wallet.publicKey, blockhash, []);

    // Sign with wallet
    const signedTx = await wallet.signTransaction(tx);

    // Send and confirm
    const signature = await sendAndConfirmTx(connection, signedTx);

    console.log('[LightProtocol] Transfer successful:', signature);

    return {
      success: true,
      signature,
    };
  } catch (error: any) {
    console.error('[LightProtocol] Transfer error:', error);
    return {
      success: false,
      error: error.message || 'Failed to transfer compressed SOL',
    };
  }
}

/**
 * Decompress SOL - Convert compressed SOL back to regular SOL
 *
 * @param wallet - User's wallet (must own compressed SOL)
 * @param amountSol - Amount to decompress
 * @param recipientPubkey - Optional recipient (defaults to sender)
 * @returns DecompressResult with transaction signature
 */
export async function decompressSOL(
  wallet: LightWallet,
  amountSol: number,
  recipientPubkey?: PublicKey
): Promise<DecompressResult> {
  try {
    console.log('[LightProtocol] Decompressing', amountSol, 'SOL...');

    const connection = createLightRpc();
    const recipient = recipientPubkey || wallet.publicKey;
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    // Get compressed accounts
    const compressedAccounts = await connection.getCompressedAccountsByOwner(wallet.publicKey);

    if (!compressedAccounts.items || compressedAccounts.items.length === 0) {
      return {
        success: false,
        error: 'No compressed SOL found to decompress.',
      };
    }

    // Get validity proof
    const proof = await connection.getValidityProof(
      compressedAccounts.items.map(a => bn(a.hash))
    );

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Create decompress instruction
    const decompressIx = await LightSystemProgram.decompress({
      payer: wallet.publicKey,
      toAddress: recipient,
      lamports: bn(lamports),
      inputCompressedAccounts: compressedAccounts.items,
      recentInputStateRootIndices: proof.rootIndices,
      recentValidityProof: proof.compressedProof,
    });

    // Add compute budget
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_000_000,
    });

    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    // Build versioned transaction
    const instructions: TransactionInstruction[] = [
      computeBudgetIx,
      computePriceIx,
      decompressIx,
    ];

    const tx = buildTx(instructions, wallet.publicKey, blockhash, []);

    // Sign with wallet
    const signedTx = await wallet.signTransaction(tx);

    // Send and confirm
    const signature = await sendAndConfirmTx(connection, signedTx);

    console.log('[LightProtocol] Decompress successful:', signature);

    return {
      success: true,
      signature,
      decompressedAmount: amountSol,
    };
  } catch (error: any) {
    console.error('[LightProtocol] Decompress error:', error);
    return {
      success: false,
      error: error.message || 'Failed to decompress SOL',
    };
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get compressed SOL balance for an address
 *
 * @param owner - Address to check
 * @returns CompressedBalance with lamports and SOL values
 */
export async function getCompressedBalance(owner: PublicKey): Promise<CompressedBalance> {
  try {
    const connection = createLightRpc();
    const accounts = await connection.getCompressedAccountsByOwner(owner);

    let totalLamports = BigInt(0);
    if (accounts.items) {
      for (const account of accounts.items) {
        totalLamports += BigInt(account.lamports.toString());
      }
    }

    return {
      lamports: Number(totalLamports),
      sol: Number(totalLamports) / LAMPORTS_PER_SOL,
    };
  } catch (error: any) {
    console.error('[LightProtocol] Balance check error:', error);
    return {
      lamports: 0,
      sol: 0,
    };
  }
}

/**
 * Check if Light Protocol is available on the current RPC
 */
export async function isLightProtocolAvailable(): Promise<boolean> {
  try {
    const connection = createLightRpc();
    // Try to get health - if it works, Light Protocol is available
    const health = await connection.getIndexerHealth();
    return health === 'ok';
  } catch (error) {
    console.error('[LightProtocol] Availability check failed:', error);
    return false;
  }
}

// ============================================================================
// Relayer Support for Gasless ZK Transfers
// ============================================================================

export interface RelayedTransferResult {
  success: boolean;
  signature?: string;
  error?: string;
  feeBreakdown?: FeeBreakdown;
}

/**
 * Get the relayer's public key from the API
 * This is needed to set the correct fee payer when building transactions
 */
export async function getRelayerPublicKey(): Promise<PublicKey | null> {
  try {
    const response = await fetch('/api/relayer/zk-transfer');
    const data = await response.json();
    if (data.configured && data.relayerAddress) {
      return new PublicKey(data.relayerAddress);
    }
    return null;
  } catch (error) {
    console.error('[LightProtocol] Failed to get relayer public key:', error);
    return null;
  }
}

/**
 * Build a ZK compress transaction with relayer as fee payer
 * Returns the partially-signed transaction for the relayer to complete
 */
export async function buildRelayedCompressTx(
  wallet: LightWallet,
  relayerPubkey: PublicKey,
  amountSol: number,
  recipientPubkey?: PublicKey
): Promise<{ tx: VersionedTransaction; error?: string }> {
  try {
    const connection = createLightRpc();
    const recipient = recipientPubkey || wallet.publicKey;
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    // Get state tree info
    const treeInfos = await getStateTreeInfos(connection);
    const outputStateTreeInfo = selectStateTreeInfo(treeInfos);

    const { blockhash } = await connection.getLatestBlockhash();

    // Create compress instruction - note: payer is still wallet for account ownership
    const compressIx = await LightSystemProgram.compress({
      payer: wallet.publicKey,
      toAddress: recipient,
      lamports: bn(lamports),
      outputStateTreeInfo,
    });

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_000_000,
    });

    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    const instructions: TransactionInstruction[] = [
      computeBudgetIx,
      computePriceIx,
      compressIx,
    ];

    // Build with RELAYER as fee payer
    const tx = buildTx(instructions, relayerPubkey, blockhash, []);

    // User signs to authorize the compress (they're sending their SOL)
    const signedTx = await wallet.signTransaction(tx);

    return { tx: signedTx };
  } catch (error: any) {
    return { tx: null as any, error: error.message };
  }
}

/**
 * Build a ZK decompress transaction with relayer as fee payer
 * This allows sending compressed SOL to a recipient without revealing fee payer
 */
export async function buildRelayedDecompressTx(
  wallet: LightWallet,
  relayerPubkey: PublicKey,
  amountSol: number,
  recipientPubkey: PublicKey
): Promise<{ tx: VersionedTransaction; error?: string }> {
  try {
    const connection = createLightRpc();
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    // Get compressed accounts
    const compressedAccounts = await connection.getCompressedAccountsByOwner(wallet.publicKey);

    if (!compressedAccounts.items || compressedAccounts.items.length === 0) {
      return { tx: null as any, error: 'No compressed SOL found to decompress.' };
    }

    // Check balance
    let totalLamports = BigInt(0);
    for (const account of compressedAccounts.items) {
      totalLamports += BigInt(account.lamports.toString());
    }

    if (totalLamports < BigInt(lamports)) {
      return {
        tx: null as any,
        error: `Insufficient compressed balance. Have ${Number(totalLamports) / LAMPORTS_PER_SOL} SOL, need ${amountSol} SOL`,
      };
    }

    // Get validity proof
    const proof = await connection.getValidityProof(
      compressedAccounts.items.map(a => bn(a.hash))
    );

    const { blockhash } = await connection.getLatestBlockhash();

    // Create decompress instruction
    const decompressIx = await LightSystemProgram.decompress({
      payer: wallet.publicKey,
      toAddress: recipientPubkey,
      lamports: bn(lamports),
      inputCompressedAccounts: compressedAccounts.items,
      recentInputStateRootIndices: proof.rootIndices,
      recentValidityProof: proof.compressedProof,
    });

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_000_000,
    });

    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    const instructions: TransactionInstruction[] = [
      computeBudgetIx,
      computePriceIx,
      decompressIx,
    ];

    // Build with RELAYER as fee payer
    const tx = buildTx(instructions, relayerPubkey, blockhash, []);

    // User signs to authorize spending their compressed accounts
    const signedTx = await wallet.signTransaction(tx);

    return { tx: signedTx };
  } catch (error: any) {
    return { tx: null as any, error: error.message };
  }
}

/**
 * Submit a partially-signed transaction to the relayer
 */
async function submitToRelayer(
  tx: VersionedTransaction,
  operationType: string
): Promise<RelayedTransferResult> {
  try {
    const txBase64 = Buffer.from(tx.serialize()).toString('base64');

    const response = await fetch('/api/relayer/zk-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signedTransaction: txBase64,
        operationType,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.details || 'Relayer submission failed',
      };
    }

    return {
      success: true,
      signature: data.signature,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to submit to relayer',
    };
  }
}

/**
 * Relayed Compress SOL - Compress with relayer paying gas
 */
export async function compressSOLRelayed(
  wallet: LightWallet,
  amountSol: number,
  recipientPubkey?: PublicKey
): Promise<CompressResult> {
  try {
    console.log('[LightProtocol] Compressing', amountSol, 'SOL via relayer...');

    // Get relayer public key
    const relayerPubkey = await getRelayerPublicKey();
    if (!relayerPubkey) {
      return {
        success: false,
        error: 'Relayer not available. Check relayer configuration.',
      };
    }

    // Build transaction with relayer as fee payer
    const { tx, error } = await buildRelayedCompressTx(
      wallet,
      relayerPubkey,
      amountSol,
      recipientPubkey
    );

    if (error || !tx) {
      return { success: false, error };
    }

    // Submit to relayer
    const result = await submitToRelayer(tx, 'compress');

    if (!result.success) {
      return { success: false, error: result.error };
    }

    console.log('[LightProtocol] Relayed compress successful:', result.signature);

    return {
      success: true,
      signature: result.signature,
      compressedAmount: amountSol,
    };
  } catch (error: any) {
    console.error('[LightProtocol] Relayed compress error:', error);
    return {
      success: false,
      error: error.message || 'Failed to compress SOL via relayer',
    };
  }
}

/**
 * Relayed Decompress SOL - Decompress with relayer paying gas
 */
export async function decompressSOLRelayed(
  wallet: LightWallet,
  amountSol: number,
  recipientPubkey: PublicKey
): Promise<DecompressResult> {
  try {
    console.log('[LightProtocol] Decompressing', amountSol, 'SOL via relayer to', recipientPubkey.toBase58());

    // Get relayer public key
    const relayerPubkey = await getRelayerPublicKey();
    if (!relayerPubkey) {
      return {
        success: false,
        error: 'Relayer not available. Check relayer configuration.',
      };
    }

    // Build transaction with relayer as fee payer
    const { tx, error } = await buildRelayedDecompressTx(
      wallet,
      relayerPubkey,
      amountSol,
      recipientPubkey
    );

    if (error || !tx) {
      return { success: false, error };
    }

    // Submit to relayer
    const result = await submitToRelayer(tx, 'decompress');

    if (!result.success) {
      return { success: false, error: result.error };
    }

    console.log('[LightProtocol] Relayed decompress successful:', result.signature);

    return {
      success: true,
      signature: result.signature,
      decompressedAmount: amountSol,
    };
  } catch (error: any) {
    console.error('[LightProtocol] Relayed decompress error:', error);
    return {
      success: false,
      error: error.message || 'Failed to decompress SOL via relayer',
    };
  }
}

// ============================================================================
// Fee-Aware Relayer Functions (Two-Transaction Model)
// ============================================================================

/**
 * Result of a two-transaction transfer with fee
 */
export interface TwoTxTransferResult {
  success: boolean;
  /** Signature of TX1 (fee to relayer) */
  feeSignature?: string;
  /** Signature of TX2 (amount to recipient) */
  transferSignature?: string;
  /** Fee breakdown */
  feeBreakdown: FeeBreakdown;
  /** Error message if failed */
  error?: string;
  /** Which step failed (1 = fee tx, 2 = transfer tx) */
  failedStep?: 1 | 2;
}

/**
 * Build a decompress transaction for a specific amount to a specific recipient
 * This is a helper function used by the two-transaction flow
 */
async function buildDecompressTx(
  wallet: LightWallet,
  relayerPubkey: PublicKey,
  amountLamports: number,
  recipientPubkey: PublicKey
): Promise<{ tx: VersionedTransaction; error?: string }> {
  try {
    const connection = createLightRpc();

    // Get compressed accounts
    const compressedAccounts = await connection.getCompressedAccountsByOwner(wallet.publicKey);

    if (!compressedAccounts.items || compressedAccounts.items.length === 0) {
      return {
        tx: null as any,
        error: 'No compressed SOL found to decompress.',
      };
    }

    // Check balance
    let totalLamports = BigInt(0);
    for (const account of compressedAccounts.items) {
      totalLamports += BigInt(account.lamports.toString());
    }

    if (totalLamports < BigInt(amountLamports)) {
      return {
        tx: null as any,
        error: `Insufficient compressed balance. Have ${Number(totalLamports) / LAMPORTS_PER_SOL} SOL, need ${amountLamports / LAMPORTS_PER_SOL} SOL`,
      };
    }

    // Get validity proof
    const proof = await connection.getValidityProof(
      compressedAccounts.items.map(a => bn(a.hash))
    );

    const { blockhash } = await connection.getLatestBlockhash();

    // Create decompress instruction
    const decompressIx = await LightSystemProgram.decompress({
      payer: wallet.publicKey,
      toAddress: recipientPubkey,
      lamports: bn(amountLamports),
      inputCompressedAccounts: compressedAccounts.items,
      recentInputStateRootIndices: proof.rootIndices,
      recentValidityProof: proof.compressedProof,
    });

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_200_000,
    });

    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    const instructions: TransactionInstruction[] = [
      computeBudgetIx,
      computePriceIx,
      decompressIx,
    ];

    // Build with RELAYER as fee payer
    const tx = buildTx(instructions, relayerPubkey, blockhash, []);

    // User signs to authorize spending their compressed accounts
    const signedTx = await wallet.signTransaction(tx);

    return { tx: signedTx };
  } catch (error: any) {
    return {
      tx: null as any,
      error: error.message,
    };
  }
}

/**
 * Wait for a transaction to be confirmed
 */
async function waitForConfirmation(signature: string, maxRetries = 30): Promise<boolean> {
  const connection = createLightRpc();

  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = await (connection as any).getSignatureStatus(signature);
      if (status?.value?.confirmationStatus === 'confirmed' ||
          status?.value?.confirmationStatus === 'finalized') {
        return true;
      }
    } catch (e) {
      // Continue waiting
    }

    // Wait 1 second before next check
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return false;
}

/**
 * Private Transfer with Fee - Two Transaction Model
 *
 * This function executes two sequential transactions:
 * 1. TX1: Decompress fee amount to relayer wallet
 * 2. TX2: Decompress remaining amount to recipient
 *
 * This ensures:
 * - Relayer actually receives SOL (not just tracked)
 * - Privacy is maintained (both txs go through relayer)
 * - Fee is deducted from private funds
 *
 * @param wallet - User's wallet with compressed SOL
 * @param recipientPubkey - Final recipient address
 * @param amountSol - Total amount to send (recipient gets amount - fee)
 * @returns TwoTxTransferResult with both signatures
 */
export async function privateTransferWithFee(
  wallet: LightWallet,
  recipientPubkey: PublicKey,
  amountSol: number
): Promise<TwoTxTransferResult> {
  // Calculate fee breakdown
  const feeBreakdown = calculateRelayerFee(amountSol);

  console.log('[LightProtocol] ====== Private Transfer with Fee ======');
  console.log('[LightProtocol] Total amount:', amountSol, 'SOL');
  console.log('[LightProtocol] Fee (to relayer):', feeBreakdown.feeAmount, 'SOL');
  console.log('[LightProtocol] Recipient receives:', feeBreakdown.recipientAmount, 'SOL');

  try {
    // Get relayer public key
    const relayerPubkey = await getRelayerPublicKey();
    if (!relayerPubkey) {
      return {
        success: false,
        feeBreakdown,
        error: 'Relayer not available. Check relayer configuration.',
      };
    }

    // ========================================
    // TX 1: Send fee to relayer
    // ========================================
    console.log('[LightProtocol] Step 1/2: Sending fee to relayer...');

    const { tx: feeTx, error: feeError } = await buildDecompressTx(
      wallet,
      relayerPubkey,
      feeBreakdown.feeLamports,
      relayerPubkey // Fee goes to relayer
    );

    if (feeError || !feeTx) {
      return {
        success: false,
        feeBreakdown,
        error: `Failed to build fee transaction: ${feeError}`,
        failedStep: 1,
      };
    }

    // Submit fee transaction to relayer
    const feeResult = await submitToRelayer(feeTx, 'fee');

    if (!feeResult.success) {
      return {
        success: false,
        feeBreakdown,
        error: `Fee transaction failed: ${feeResult.error}`,
        failedStep: 1,
      };
    }

    console.log('[LightProtocol] ✅ TX1 (fee) confirmed:', feeResult.signature);

    // Wait for TX1 to be confirmed before proceeding
    console.log('[LightProtocol] Waiting for fee transaction confirmation...');
    const confirmed = await waitForConfirmation(feeResult.signature!, 20);

    if (!confirmed) {
      console.log('[LightProtocol] ⚠️ TX1 confirmation timeout, proceeding anyway...');
    }

    // Small delay to ensure state is updated
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ========================================
    // TX 2: Send remaining amount to recipient
    // ========================================
    console.log('[LightProtocol] Step 2/2: Sending to recipient...');

    const { tx: transferTx, error: transferError } = await buildDecompressTx(
      wallet,
      relayerPubkey,
      feeBreakdown.recipientLamports,
      recipientPubkey // Amount goes to recipient
    );

    if (transferError || !transferTx) {
      return {
        success: false,
        feeBreakdown,
        feeSignature: feeResult.signature,
        error: `Failed to build transfer transaction: ${transferError}. Fee was already sent to relayer.`,
        failedStep: 2,
      };
    }

    // Submit transfer transaction to relayer
    const transferResult = await submitToRelayer(transferTx, 'transfer');

    if (!transferResult.success) {
      return {
        success: false,
        feeBreakdown,
        feeSignature: feeResult.signature,
        error: `Transfer transaction failed: ${transferResult.error}. Fee was already sent to relayer.`,
        failedStep: 2,
      };
    }

    console.log('[LightProtocol] ✅ TX2 (transfer) confirmed:', transferResult.signature);

    // ========================================
    // Success!
    // ========================================
    console.log('[LightProtocol] ====== Transfer Complete! ======');
    console.log('[LightProtocol] Relayer received:', feeBreakdown.feeAmount, 'SOL');
    console.log('[LightProtocol] Recipient received:', feeBreakdown.recipientAmount, 'SOL');

    return {
      success: true,
      feeSignature: feeResult.signature,
      transferSignature: transferResult.signature,
      feeBreakdown,
    };

  } catch (error: any) {
    console.error('[LightProtocol] Private transfer with fee error:', error);
    return {
      success: false,
      feeBreakdown,
      error: error.message || 'Failed to complete private transfer with fee',
    };
  }
}

/**
 * Build a ZK decompress transaction with fee deduction (Legacy - single tx approach)
 * @deprecated Use privateTransferWithFee for actual fee collection
 */
export async function buildRelayedDecompressTxWithFee(
  wallet: LightWallet,
  relayerPubkey: PublicKey,
  amountSol: number,
  recipientPubkey: PublicKey
): Promise<{ tx: VersionedTransaction; feeBreakdown: FeeBreakdown; error?: string }> {
  const feeBreakdown = calculateRelayerFee(amountSol);
  const { tx, error } = await buildDecompressTx(
    wallet,
    relayerPubkey,
    feeBreakdown.recipientLamports,
    recipientPubkey
  );
  return { tx, feeBreakdown, error };
}

/**
 * Relayed Decompress SOL with Fee (Legacy - uses single tx, fee tracked only)
 * @deprecated Use privateTransferWithFee for actual fee collection
 */
export async function decompressSOLRelayedWithFee(
  wallet: LightWallet,
  amountSol: number,
  recipientPubkey: PublicKey
): Promise<DecompressResult & { feeBreakdown?: FeeBreakdown }> {
  // Delegate to the new two-tx implementation
  const result = await privateTransferWithFee(wallet, recipientPubkey, amountSol);

  return {
    success: result.success,
    signature: result.transferSignature,
    decompressedAmount: result.feeBreakdown.recipientAmount,
    feeBreakdown: result.feeBreakdown,
    error: result.error,
  };
}

/**
 * Submit a transaction to the relayer with fee information
 */
async function submitToRelayerWithFee(
  tx: VersionedTransaction,
  operationType: string,
  feeBreakdown: FeeBreakdown
): Promise<RelayedTransferResult> {
  try {
    const txBase64 = Buffer.from(tx.serialize()).toString('base64');

    const response = await fetch('/api/relayer/zk-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signedTransaction: txBase64,
        operationType,
        feeInfo: {
          originalAmount: feeBreakdown.originalAmount,
          recipientAmount: feeBreakdown.recipientAmount,
          feeAmount: feeBreakdown.feeAmount,
          feeLamports: feeBreakdown.feeLamports,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.details || 'Relayer submission failed',
      };
    }

    return {
      success: true,
      signature: data.signature,
      feeBreakdown,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to submit to relayer',
    };
  }
}

/**
 * Private ZK Donation with Relayer and Fee - Complete privacy with fee deduction
 *
 * This achieves maximum privacy while sustaining the relayer:
 * - Sender identity hidden via ZK compression
 * - Fee payer identity hidden via relayer
 * - Relayer fee deducted from transfer (not public wallet)
 * - Amount verified via zero-knowledge proof
 *
 * @param wallet - User's wallet
 * @param recipientPubkey - Recipient address
 * @param amountSol - Total amount (recipient gets amount - fee)
 * @returns Result with fee breakdown
 */
export async function privateZKDonationRelayedWithFee(
  wallet: LightWallet,
  recipientPubkey: PublicKey,
  amountSol: number
): Promise<RelayedTransferResult> {
  try {
    const feeBreakdown = calculateRelayerFee(amountSol);

    console.log('[LightProtocol] Starting RELAYED private ZK donation with fee');
    console.log('[LightProtocol] Amount:', amountSol, 'SOL');
    console.log('[LightProtocol] Recipient will receive:', feeBreakdown.recipientAmount, 'SOL');
    console.log('[LightProtocol] Relayer fee:', feeBreakdown.feeAmount, 'SOL');

    // Step 1: Check current compressed balance
    const currentBalance = await getCompressedBalance(wallet.publicKey);
    console.log('[LightProtocol] Current compressed balance:', currentBalance.sol, 'SOL');

    const lamportsNeeded = feeBreakdown.originalLamports;

    // Step 2: Compress more SOL if needed (via relayer)
    if (currentBalance.lamports < lamportsNeeded) {
      const toCompress = amountSol - currentBalance.sol + 0.002;
      console.log('[LightProtocol] Need to compress', toCompress, 'SOL first (via relayer)');

      const compressResult = await compressSOLRelayed(wallet, toCompress);
      if (!compressResult.success) {
        return {
          success: false,
          error: `Failed to compress SOL: ${compressResult.error}`,
          feeBreakdown,
        };
      }

      console.log('[LightProtocol] Relayed compression successful');
    }

    // Step 3: Decompress to recipient with fee deduction
    const decompressResult = await decompressSOLRelayedWithFee(
      wallet,
      amountSol,
      recipientPubkey
    );

    if (!decompressResult.success) {
      return {
        success: false,
        error: `Failed to decompress to recipient: ${decompressResult.error}`,
        feeBreakdown,
      };
    }

    console.log('[LightProtocol] ✅ Relayed private ZK donation with fee complete!');
    console.log('[LightProtocol] Recipient received:', feeBreakdown.recipientAmount, 'SOL');
    console.log('[LightProtocol] Relayer earned:', feeBreakdown.feeAmount, 'SOL');

    return {
      success: true,
      signature: decompressResult.signature,
      feeBreakdown,
    };

  } catch (error: any) {
    console.error('[LightProtocol] Relayed private donation with fee error:', error);
    return {
      success: false,
      error: error.message || 'Failed to complete relayed private donation',
    };
  }
}

/**
 * Private ZK Donation with Relayer - Complete privacy with gasless transfer
 * @deprecated Use privateZKDonationRelayedWithFee for fee-aware transfers
 *
 * This achieves maximum privacy:
 * - Sender identity hidden via ZK compression
 * - Fee payer identity hidden via relayer
 * - Amount verified via zero-knowledge proof
 */
export async function privateZKDonationRelayed(
  wallet: LightWallet,
  recipientPubkey: PublicKey,
  amountSol: number
): Promise<TransferResult> {
  // Delegate to fee-aware version
  const result = await privateZKDonationRelayedWithFee(wallet, recipientPubkey, amountSol);
  return {
    success: result.success,
    signature: result.signature,
    error: result.error,
  };
}

// ============================================================================
// High-Level Privacy Functions
// ============================================================================

/**
 * Private ZK Donation - Complete privacy donation flow
 *
 * This is the main entry point for privacy donations.
 * It handles the full flow:
 * 1. Compress the donor's SOL (breaks sender link)
 * 2. Transfer compressed SOL to recipient
 *
 * The result is a donation where:
 * - The donor's identity is hidden
 * - The amount is verified via ZK proof
 * - Only Merkle root updates are on-chain
 *
 * @param wallet - Donor's wallet
 * @param recipientPubkey - Campaign vault address
 * @param amountSol - Amount to donate in SOL
 * @returns TransferResult with transaction signature
 */
export async function privateZKDonation(
  wallet: LightWallet,
  recipientPubkey: PublicKey,
  amountSol: number
): Promise<TransferResult> {
  try {
    console.log('[LightProtocol] Starting private ZK donation of', amountSol, 'SOL to', recipientPubkey.toBase58());

    // Step 1: Compress SOL to hide sender identity
    // Check if we already have enough compressed SOL
    const currentBalance = await getCompressedBalance(wallet.publicKey);
    console.log('[LightProtocol] Current compressed balance:', currentBalance.sol, 'SOL');

    const lamportsNeeded = Math.floor(amountSol * LAMPORTS_PER_SOL);

    if (currentBalance.lamports < lamportsNeeded) {
      // Need to compress more SOL first
      const toCompress = amountSol - currentBalance.sol + 0.002; // Add buffer for fees
      console.log('[LightProtocol] Need to compress', toCompress, 'SOL first');

      const compressResult = await compressSOL(wallet, toCompress);
      if (!compressResult.success) {
        return {
          success: false,
          error: `Failed to compress SOL: ${compressResult.error}`,
        };
      }

      console.log('[LightProtocol] Compression successful, now decompressing to recipient...');
    }

    // Step 2: Decompress SOL directly to the campaign vault
    // This sends REGULAR SOL to the vault (not compressed SOL)
    // The vault can now see and use this balance
    const decompressResult = await decompressSOL(wallet, amountSol, recipientPubkey);

    if (!decompressResult.success) {
      return {
        success: false,
        error: `Failed to decompress to vault: ${decompressResult.error}`,
      };
    }

    console.log('[LightProtocol] Private ZK donation complete! Vault received regular SOL.');
    return {
      success: true,
      signature: decompressResult.signature,
    };

  } catch (error: any) {
    console.error('[LightProtocol] Private donation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to complete private donation',
    };
  }
}
