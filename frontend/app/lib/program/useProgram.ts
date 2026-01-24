'use client';

import { useMemo, useCallback } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import idlJson from './idl/offuscate.json';
import {
  PROGRAM_ID,
  CampaignData,
  StealthRegistryData,
  PrivacyPoolData,
  PendingWithdrawData,
  ChurnVaultData,
  getCampaignPDAs,
  getStealthRegistryPDA,
  getPrivacyPoolPDAs,
  getPendingWithdrawPDA,
  getChurnVaultPDAs,
  fetchVaultBalance as fetchVaultBalanceFn,
  ALLOWED_WITHDRAW_AMOUNTS,
  WITHDRAW_DELAY_SECONDS,
  MIN_DELAY_SECONDS,
  MAX_DELAY_SECONDS,
  CHURN_VAULT_COUNT,
} from './client';

const idl = idlJson as Idl;

/**
 * Hook that provides all program operations
 */
export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  // Create program instance
  const program = useMemo(() => {
    // Use dummy wallet for read-only operations
    const walletToUse = wallet || {
      publicKey: Keypair.generate().publicKey,
      signTransaction: async () => { throw new Error('Wallet not connected'); },
      signAllTransactions: async () => { throw new Error('Wallet not connected'); },
    };

    const provider = new AnchorProvider(connection, walletToUse as any, {
      commitment: 'confirmed',
    });

    return new Program(idl, provider);
  }, [connection, wallet]);

  // ============================================
  // READ OPERATIONS (no wallet needed)
  // ============================================

  const listCampaigns = useCallback(async (): Promise<{ pubkey: PublicKey; account: CampaignData }[]> => {
    try {
      const accounts = await (program.account as any).campaign.all();

      return accounts.map(({ publicKey, account }: any) => ({
        pubkey: publicKey,
        account: parseCampaignAccount(account),
      }));
    } catch (e) {
      console.error('Failed to list campaigns:', e);
      return [];
    }
  }, [program]);

  const fetchCampaign = useCallback(async (campaignId: string): Promise<CampaignData | null> => {
    const { campaignPda } = getCampaignPDAs(campaignId);

    try {
      const account = await (program.account as any).campaign.fetch(campaignPda);
      return parseCampaignAccount(account);
    } catch {
      return null;
    }
  }, [program]);

  const fetchVaultBalance = useCallback(async (campaignId: string): Promise<number> => {
    return fetchVaultBalanceFn(connection, campaignId);
  }, [connection]);

  const fetchStealthRegistries = useCallback(async (campaignPda: PublicKey): Promise<StealthRegistryData[]> => {
    try {
      const accounts = await (program.account as any).stealthRegistry.all([
        {
          memcmp: {
            offset: 8,
            bytes: campaignPda.toBase58(),
          },
        },
      ]);

      return accounts.map(({ account }: any) => parseStealthRegistryAccount(account));
    } catch (e) {
      console.error('Failed to fetch stealth registries:', e);
      return [];
    }
  }, [program]);

  // ============================================
  // WRITE OPERATIONS (wallet required)
  // ============================================

  const createCampaign = useCallback(async (
    campaignId: string,
    title: string,
    description: string,
    goalSol: number,
    deadlineTimestamp: number
  ): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { campaignPda, vaultPda } = getCampaignPDAs(campaignId);
    const { BN } = await import('@coral-xyz/anchor');
    const { LAMPORTS_PER_SOL, SystemProgram } = await import('@solana/web3.js');

    const goalLamports = new BN(goalSol * LAMPORTS_PER_SOL);

    return program.methods
      .createCampaign(campaignId, title, description, goalLamports, new BN(deadlineTimestamp))
      .accounts({
        owner: wallet.publicKey,
        campaign: campaignPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  const donate = useCallback(async (
    campaignId: string,
    amountSol: number
  ): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { campaignPda, vaultPda } = getCampaignPDAs(campaignId);
    const { BN } = await import('@coral-xyz/anchor');
    const { LAMPORTS_PER_SOL, SystemProgram } = await import('@solana/web3.js');

    const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

    return program.methods
      .donate(amountLamports)
      .accounts({
        donor: wallet.publicKey,
        campaign: campaignPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  const withdraw = useCallback(async (
    campaignId: string,
    amountSol: number
  ): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { campaignPda, vaultPda } = getCampaignPDAs(campaignId);
    const { BN } = await import('@coral-xyz/anchor');
    const { LAMPORTS_PER_SOL, SystemProgram } = await import('@solana/web3.js');

    const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

    return program.methods
      .withdraw(amountLamports)
      .accounts({
        owner: wallet.publicKey,
        campaign: campaignPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  const closeCampaign = useCallback(async (campaignId: string): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { campaignPda } = getCampaignPDAs(campaignId);
    const { SystemProgram } = await import('@solana/web3.js');

    return program.methods
      .closeCampaign()
      .accounts({
        owner: wallet.publicKey,
        campaign: campaignPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  const setStealthMetaAddress = useCallback(async (
    campaignId: string,
    stealthMetaAddress: string
  ): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { campaignPda } = getCampaignPDAs(campaignId);

    return program.methods
      .setStealthMetaAddress(stealthMetaAddress)
      .accounts({
        owner: wallet.publicKey,
        campaign: campaignPda,
      })
      .rpc();
  }, [program, wallet]);

  const registerStealthPayment = useCallback(async (
    campaignId: string,
    stealthAddress: PublicKey,
    ephemeralPubKey: string,
    amountSol: number
  ): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { campaignPda } = getCampaignPDAs(campaignId);
    const { registryPda } = getStealthRegistryPDA(campaignPda, stealthAddress);
    const { BN } = await import('@coral-xyz/anchor');
    const { LAMPORTS_PER_SOL, SystemProgram } = await import('@solana/web3.js');

    const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

    return program.methods
      .registerStealthPayment(stealthAddress, ephemeralPubKey, amountLamports)
      .accounts({
        donor: wallet.publicKey,
        campaign: campaignPda,
        registry: registryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  // ============================================
  // PRIVACY POOL OPERATIONS
  // ============================================

  /**
   * Initialize the privacy pool (called once)
   */
  const initPool = useCallback(async (): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
    const { SystemProgram } = await import('@solana/web3.js');

    return program.methods
      .initPrivacyPool()
      .accounts({
        authority: wallet.publicKey,
        pool: poolPda,
        poolVault: poolVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  /**
   * Deposit SOL into privacy pool (breaks link between donor and recipient)
   */
  const poolDeposit = useCallback(async (amountSol: number): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
    const { BN } = await import('@coral-xyz/anchor');
    const { LAMPORTS_PER_SOL, SystemProgram } = await import('@solana/web3.js');

    const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

    return program.methods
      .poolDeposit(amountLamports)
      .accounts({
        depositor: wallet.publicKey,
        pool: poolPda,
        poolVault: poolVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  /**
   * Request withdrawal from pool with delay
   * Amount must be 0.1, 0.5, or 1.0 SOL
   */
  const requestPoolWithdraw = useCallback(async (
    recipientKeypair: Keypair,
    amountSol: number
  ): Promise<string> => {
    if (!wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }
    if (!ALLOWED_WITHDRAW_AMOUNTS.includes(amountSol)) {
      throw new Error(`Invalid amount. Must be one of: ${ALLOWED_WITHDRAW_AMOUNTS.join(', ')} SOL`);
    }

    const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
    const { pendingPda } = getPendingWithdrawPDA(recipientKeypair.publicKey);
    const { BN } = await import('@coral-xyz/anchor');
    const { LAMPORTS_PER_SOL, SystemProgram } = await import('@solana/web3.js');

    const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

    return program.methods
      .requestWithdraw(amountLamports)
      .accounts({
        payer: wallet.publicKey,
        recipient: recipientKeypair.publicKey,
        pool: poolPda,
        poolVault: poolVaultPda,
        pendingWithdraw: pendingPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([recipientKeypair])
      .rpc();
  }, [program, wallet]);

  /**
   * Claim pending withdrawal after delay
   */
  const claimPoolWithdraw = useCallback(async (
    recipientKeypair: Keypair
  ): Promise<string> => {
    const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
    const { pendingPda } = getPendingWithdrawPDA(recipientKeypair.publicKey);
    const { SystemProgram } = await import('@solana/web3.js');

    return program.methods
      .claimWithdraw()
      .accounts({
        recipient: recipientKeypair.publicKey,
        pool: poolPda,
        poolVault: poolVaultPda,
        pendingWithdraw: pendingPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([recipientKeypair])
      .rpc();
  }, [program]);

  /**
   * Claim pending withdrawal GASLESS via relayer
   *
   * PRIVACY FEATURE: The stealth address does NOT pay gas and does NOT appear as tx signer.
   * Instead, a relayer submits the transaction and pays fees.
   *
   * Flow:
   * 1. Sign message "claim:{pendingPda}" with stealth keypair
   * 2. Send signature to relayer API
   * 3. Relayer submits tx with ed25519 verification
   * 4. Funds arrive at stealth address
   *
   * Result: No link between stealth address and fee payer
   */
  const claimPoolWithdrawGasless = useCallback(async (
    recipientKeypair: Keypair
  ): Promise<{ signature: string; relayer: string }> => {
    const { pendingPda } = getPendingWithdrawPDA(recipientKeypair.publicKey);
    const { sign } = await import('tweetnacl');
    const bs58 = await import('bs58');

    // Create the message to sign: "claim:{pendingPda}"
    const message = Buffer.from(`claim:${pendingPda.toString()}`);

    // Sign the message with the stealth keypair
    const signature = sign.detached(message, recipientKeypair.secretKey);
    const signatureBase58 = bs58.default.encode(signature);

    // Call the relayer API
    const response = await fetch('/api/relayer/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pendingPda: pendingPda.toString(),
        recipient: recipientKeypair.publicKey.toString(),
        signature: signatureBase58,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.details || 'Relayer claim failed');
    }

    return {
      signature: result.signature,
      relayer: result.relayer,
    };
  }, []);

  /**
   * Check relayer status
   */
  const checkRelayerStatus = useCallback(async (): Promise<{
    configured: boolean;
    relayerAddress: string | null;
    balance: number | null;
  }> => {
    const response = await fetch('/api/relayer/claim');
    return response.json();
  }, []);

  /**
   * Fetch privacy pool stats
   */
  const fetchPoolStats = useCallback(async (): Promise<PrivacyPoolData | null> => {
    const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();

    try {
      const account = await (program.account as any).privacyPool.fetch(poolPda);
      const { LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const vaultBalance = await connection.getBalance(poolVaultPda);

      return {
        totalDeposited: account.totalDeposited.toNumber() / LAMPORTS_PER_SOL,
        totalWithdrawn: account.totalWithdrawn.toNumber() / LAMPORTS_PER_SOL,
        depositCount: account.depositCount.toNumber(),
        withdrawCount: account.withdrawCount.toNumber(),
        churnCount: account.churnCount?.toNumber?.() ?? 0,
        currentBalance: vaultBalance / LAMPORTS_PER_SOL,
        bump: account.bump,
        vaultBump: account.vaultBump,
      };
    } catch {
      return null;
    }
  }, [program, connection]);

  /**
   * Fetch pending withdrawal for a recipient
   */
  const fetchPendingWithdraw = useCallback(async (
    recipient: PublicKey
  ): Promise<PendingWithdrawData | null> => {
    const { pendingPda } = getPendingWithdrawPDA(recipient);

    try {
      const account = await (program.account as any).pendingWithdraw.fetch(pendingPda);
      const { LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const now = Math.floor(Date.now() / 1000);
      const availableAt = account.availableAt.toNumber();
      const timeRemaining = Math.max(0, availableAt - now);

      return {
        recipient: account.recipient,
        amount: account.amount.toNumber() / LAMPORTS_PER_SOL,
        requestedAt: account.requestedAt.toNumber(),
        availableAt,
        claimed: account.claimed,
        bump: account.bump,
        timeRemaining,
        isReady: timeRemaining === 0 && !account.claimed,
      };
    } catch {
      return null;
    }
  }, [program]);

  /**
   * Check if pool is initialized
   */
  const isPoolInitialized = useCallback(async (): Promise<boolean> => {
    const stats = await fetchPoolStats();
    return stats !== null;
  }, [fetchPoolStats]);

  // ============================================
  // POOL CHURN OPERATIONS (anti-correlation)
  // ============================================

  /**
   * Initialize a churn vault (0-2)
   */
  const initChurnVault = useCallback(async (index: number): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');
    if (index < 0 || index >= CHURN_VAULT_COUNT) {
      throw new Error(`Invalid churn vault index. Must be 0-${CHURN_VAULT_COUNT - 1}`);
    }

    const { poolPda } = getPrivacyPoolPDAs();
    const { churnStatePda, churnVaultPda } = getChurnVaultPDAs(index);
    const { SystemProgram } = await import('@solana/web3.js');

    return program.methods
      .initChurnVault(index)
      .accounts({
        authority: wallet.publicKey,
        pool: poolPda,
        churnVaultState: churnStatePda,
        churnVault: churnVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  /**
   * Pool Churn - Move funds to internal vault (breaks graph analysis)
   */
  const poolChurn = useCallback(async (index: number, amountSol: number): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
    const { churnStatePda, churnVaultPda } = getChurnVaultPDAs(index);
    const { BN } = await import('@coral-xyz/anchor');
    const { LAMPORTS_PER_SOL, SystemProgram } = await import('@solana/web3.js');

    const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

    return program.methods
      .poolChurn(amountLamports)
      .accounts({
        authority: wallet.publicKey,
        pool: poolPda,
        poolVault: poolVaultPda,
        churnVaultState: churnStatePda,
        churnVault: churnVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  /**
   * Pool Unchurn - Return funds from churn vault to main pool
   */
  const poolUnchurn = useCallback(async (index: number, amountSol: number): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
    const { churnStatePda, churnVaultPda } = getChurnVaultPDAs(index);
    const { BN } = await import('@coral-xyz/anchor');
    const { LAMPORTS_PER_SOL, SystemProgram } = await import('@solana/web3.js');

    const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

    return program.methods
      .poolUnchurn(amountLamports)
      .accounts({
        authority: wallet.publicKey,
        pool: poolPda,
        poolVault: poolVaultPda,
        churnVaultState: churnStatePda,
        churnVault: churnVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  /**
   * BATCH CLAIM WITHDRAWALS
   *
   * PRIVACY FEATURE: Processes multiple pending withdrawals in a single transaction.
   * This breaks the visual pattern of "1 withdraw = 1 tx" that analysts use for correlation.
   *
   * @param recipientKeypairs - Array of stealth keypairs with pending withdrawals (max 5)
   * @returns Transaction signature
   */
  const batchClaimPoolWithdraw = useCallback(async (
    recipientKeypairs: Keypair[]
  ): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');
    if (recipientKeypairs.length === 0) throw new Error('No recipients provided');
    if (recipientKeypairs.length > 5) throw new Error('Maximum 5 withdrawals per batch');

    const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
    const { SystemProgram } = await import('@solana/web3.js');

    // Build remaining accounts array: pairs of (pending_pda, recipient)
    const remainingAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];

    for (const recipient of recipientKeypairs) {
      const { pendingPda } = getPendingWithdrawPDA(recipient.publicKey);

      // Add pending withdraw PDA (writable, not signer)
      remainingAccounts.push({
        pubkey: pendingPda,
        isSigner: false,
        isWritable: true,
      });

      // Add recipient (writable to receive SOL)
      remainingAccounts.push({
        pubkey: recipient.publicKey,
        isSigner: false,
        isWritable: true,
      });
    }

    return program.methods
      .batchClaimWithdraw()
      .accounts({
        authority: wallet.publicKey,
        pool: poolPda,
        poolVault: poolVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .rpc();
  }, [program, wallet]);

  /**
   * Fetch all pending withdrawals that are ready to claim
   * Useful for batch operations
   */
  const fetchReadyWithdrawals = useCallback(async (): Promise<{
    recipient: PublicKey;
    pendingPda: PublicKey;
    amount: number;
  }[]> => {
    try {
      const accounts = await (program.account as any).pendingWithdraw.all();
      const { LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const now = Math.floor(Date.now() / 1000);

      return accounts
        .filter(({ account }: any) => {
          const availableAt = account.availableAt.toNumber();
          return !account.claimed && now >= availableAt;
        })
        .map(({ publicKey, account }: any) => ({
          recipient: account.recipient,
          pendingPda: publicKey,
          amount: account.amount.toNumber() / LAMPORTS_PER_SOL,
        }));
    } catch (e) {
      console.error('Failed to fetch ready withdrawals:', e);
      return [];
    }
  }, [program]);

  /**
   * Fetch churn vault data
   */
  const fetchChurnVault = useCallback(async (index: number): Promise<ChurnVaultData | null> => {
    const { churnStatePda, churnVaultPda } = getChurnVaultPDAs(index);

    try {
      const account = await (program.account as any).churnVaultState.fetch(churnStatePda);
      const { LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const balance = await connection.getBalance(churnVaultPda);

      return {
        index: account.index,
        bump: account.bump,
        balance: balance / LAMPORTS_PER_SOL,
      };
    } catch {
      return null;
    }
  }, [program, connection]);

  return {
    // Program instance (for advanced usage)
    program,
    connection,
    wallet,
    isConnected: !!wallet,

    // Read operations
    listCampaigns,
    fetchCampaign,
    fetchVaultBalance,
    fetchStealthRegistries,

    // Write operations
    createCampaign,
    donate,
    withdraw,
    closeCampaign,
    setStealthMetaAddress,
    registerStealthPayment,

    // Privacy Pool operations
    initPool,
    poolDeposit,
    requestPoolWithdraw,
    claimPoolWithdraw,
    claimPoolWithdrawGasless,
    checkRelayerStatus,
    fetchPoolStats,
    fetchPendingWithdraw,
    isPoolInitialized,

    // Pool Churn operations (anti-correlation)
    initChurnVault,
    poolChurn,
    poolUnchurn,
    fetchChurnVault,

    // Batch operations (breaks 1 withdraw = 1 tx pattern)
    batchClaimPoolWithdraw,
    fetchReadyWithdrawals,

    // Constants
    ALLOWED_WITHDRAW_AMOUNTS,
    WITHDRAW_DELAY_SECONDS,
    MIN_DELAY_SECONDS,
    MAX_DELAY_SECONDS,
    CHURN_VAULT_COUNT,

    // Helpers
    getCampaignPDAs,
    getStealthRegistryPDA,
    getPrivacyPoolPDAs,
    getPendingWithdrawPDA,
    getChurnVaultPDAs,
  };
}

// ============================================
// ACCOUNT PARSERS
// ============================================

function parseCampaignAccount(account: any): CampaignData {
  const { LAMPORTS_PER_SOL } = require('@solana/web3.js');

  const statusMap: Record<string, 'Active' | 'Closed' | 'Completed'> = {
    active: 'Active',
    closed: 'Closed',
    completed: 'Completed',
  };

  const statusKey = Object.keys(account.status)[0];

  return {
    owner: account.owner,
    campaignId: account.campaignId,
    title: account.title,
    description: account.description,
    goal: account.goal.toNumber() / LAMPORTS_PER_SOL,
    totalRaised: account.totalRaised.toNumber() / LAMPORTS_PER_SOL,
    donorCount: account.donorCount.toNumber(),
    deadline: account.deadline.toNumber(),
    status: statusMap[statusKey] || 'Active',
    createdAt: account.createdAt.toNumber(),
    vaultBump: account.vaultBump,
    campaignBump: account.campaignBump,
    stealthMetaAddress: account.stealthMetaAddress,
    stealthDonations: account.stealthDonations.toNumber(),
    stealthTotal: account.stealthTotal.toNumber() / LAMPORTS_PER_SOL,
  };
}

function parseStealthRegistryAccount(account: any): StealthRegistryData {
  const { LAMPORTS_PER_SOL } = require('@solana/web3.js');

  return {
    campaign: account.campaign,
    stealthAddress: account.stealthAddress,
    ephemeralPubKey: account.ephemeralPubKey,
    amount: account.amount.toNumber() / LAMPORTS_PER_SOL,
    timestamp: account.timestamp.toNumber(),
    bump: account.bump,
  };
}
