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
  InviteData,
  getCampaignPDAs,
  getStealthRegistryPDA,
  getPrivacyPoolPDAs,
  getPendingWithdrawPDA,
  getChurnVaultPDAs,
  getInvitePDA,
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

    // Ensure IDL has the correct program address
    const idlWithAddress = { ...idl, address: PROGRAM_ID.toBase58() };
    return new Program(idlWithAddress as Idl, provider);
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

  const fetchCampaignByPda = useCallback(async (campaignPda: PublicKey): Promise<CampaignData | null> => {
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
  // INVITE OPERATIONS
  // ============================================

  /**
   * Generate a random invite code
   */
  const generateInviteCode = useCallback((): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }, []);

  /**
   * Create an invite for a recipient to join a payroll batch
   */
  const createInvite = useCallback(async (
    campaignId: string,
    inviteCode?: string
  ): Promise<{ signature: string; inviteCode: string }> => {
    if (!wallet) throw new Error('Wallet not connected');

    const code = inviteCode || generateInviteCode();
    const { campaignPda } = getCampaignPDAs(campaignId);
    const { invitePda } = getInvitePDA(code);
    const { SystemProgram } = await import('@solana/web3.js');

    const signature = await program.methods
      .createInvite(code)
      .accounts({
        owner: wallet.publicKey,
        campaign: campaignPda,
        invite: invitePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { signature, inviteCode: code };
  }, [program, wallet, generateInviteCode]);

  /**
   * Accept an invite and register stealth address
   */
  const acceptInvite = useCallback(async (
    inviteCode: string,
    stealthMetaAddress: string
  ): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { invitePda } = getInvitePDA(inviteCode);
    const { SystemProgram } = await import('@solana/web3.js');

    return program.methods
      .acceptInvite(stealthMetaAddress)
      .accounts({
        recipient: wallet.publicKey,
        invite: invitePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  /**
   * Revoke an invite (only creator can revoke)
   */
  const revokeInvite = useCallback(async (inviteCode: string): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { invitePda } = getInvitePDA(inviteCode);
    const { SystemProgram } = await import('@solana/web3.js');

    return program.methods
      .revokeInvite()
      .accounts({
        owner: wallet.publicKey,
        invite: invitePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, wallet]);

  /**
   * Fetch an invite by code
   */
  const fetchInvite = useCallback(async (inviteCode: string): Promise<InviteData | null> => {
    const { invitePda } = getInvitePDA(inviteCode);

    try {
      const account = await (program.account as any).invite.fetch(invitePda);
      return parseInviteAccount(account);
    } catch {
      return null;
    }
  }, [program]);

  /**
   * List all invites for a campaign (batch)
   */
  const listInvitesByBatch = useCallback(async (campaignId: string): Promise<InviteData[]> => {
    const { campaignPda } = getCampaignPDAs(campaignId);

    try {
      const accounts = await (program.account as any).invite.all([
        {
          memcmp: {
            offset: 8, // After discriminator
            bytes: campaignPda.toBase58(),
          },
        },
      ]);

      return accounts.map(({ account }: any) => parseInviteAccount(account));
    } catch (e) {
      console.error('Failed to list invites:', e);
      return [];
    }
  }, [program]);

  /**
   * List all invites where connected wallet is the recipient
   */
  const listMyInvites = useCallback(async (): Promise<InviteData[]> => {
    if (!wallet) return [];

    try {
      // Get all invites and filter by recipient
      const accounts = await (program.account as any).invite.all();
      return accounts
        .map(({ account }: any) => parseInviteAccount(account))
        .filter((invite: InviteData) =>
          invite.recipient.toBase58() === wallet.publicKey.toBase58() ||
          invite.status === 'Pending' // Also show pending invites (anyone can accept)
        );
    } catch (e) {
      console.error('Failed to list my invites:', e);
      return [];
    }
  }, [program, wallet]);

  /**
   * List all invites created by connected wallet (employer)
   */
  const listMyCreatedInvites = useCallback(async (): Promise<InviteData[]> => {
    if (!wallet) return [];

    try {
      const accounts = await (program.account as any).invite.all();
      return accounts
        .map(({ account }: any) => parseInviteAccount(account))
        .filter((invite: InviteData) =>
          invite.creator.toBase58() === wallet.publicKey.toBase58()
        );
    } catch (e) {
      console.error('Failed to list created invites:', e);
      return [];
    }
  }, [program, wallet]);

  /**
   * Check if user is an employer (owns at least one campaign/batch)
   */
  const checkIsEmployer = useCallback(async (): Promise<boolean> => {
    if (!wallet) return false;

    try {
      const campaigns = await listCampaigns();
      return campaigns.some(c => c.account.owner.toBase58() === wallet.publicKey.toBase58());
    } catch {
      return false;
    }
  }, [wallet, listCampaigns]);

  /**
   * Check if user is a recipient (has accepted at least one invite)
   */
  const checkIsRecipient = useCallback(async (): Promise<boolean> => {
    if (!wallet) return false;

    try {
      const accounts = await (program.account as any).invite.all();
      return accounts.some(({ account }: any) => {
        const invite = parseInviteAccount(account);
        return invite.recipient.toBase58() === wallet.publicKey.toBase58() &&
               invite.status === 'Accepted';
      });
    } catch {
      return false;
    }
  }, [program, wallet]);

  /**
   * Determine user role based on on-chain data
   */
  const determineRole = useCallback(async (): Promise<'employer' | 'recipient' | null> => {
    const isEmployer = await checkIsEmployer();
    if (isEmployer) return 'employer';

    const isRecipient = await checkIsRecipient();
    if (isRecipient) return 'recipient';

    return null;
  }, [checkIsEmployer, checkIsRecipient]);

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

  // ============================================
  // PHASE 3: COMMITMENT-BASED PRIVATE OPERATIONS
  // ============================================

  /**
   * Private deposit with commitment (ZK-like privacy)
   *
   * PRIVACY FLOW:
   * 1. Generate random secret + nullifier_secret
   * 2. Compute commitment = hash(secret_hash || nullifier || amount)
   * 3. Deposit with just the commitment (secrets stay local)
   * 4. Store secrets in localStorage for later withdrawal
   *
   * Result: Deposit cannot be linked to future withdrawal without secrets
   *
   * @param amountSol - Amount to deposit (must be 0.1, 0.5, or 1.0 SOL)
   * @returns Transaction signature and the private note (save this!)
   */
  const privateDeposit = useCallback(async (
    amountSol: number
  ): Promise<{ signature: string; note: any }> => {
    if (!wallet) throw new Error('Wallet not connected');
    if (!ALLOWED_WITHDRAW_AMOUNTS.includes(amountSol)) {
      throw new Error(`Invalid amount. Must be one of: ${ALLOWED_WITHDRAW_AMOUNTS.join(', ')} SOL`);
    }

    const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
    const { BN } = await import('@coral-xyz/anchor');
    const { LAMPORTS_PER_SOL, SystemProgram, PublicKey } = await import('@solana/web3.js');
    const { generatePrivateNote, saveNote, toArray32 } = await import('../privacy');

    const amountLamports = amountSol * LAMPORTS_PER_SOL;
    const note = await generatePrivateNote(amountLamports);

    // Get the commitment PDA
    const [commitmentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('commitment'), Buffer.from(note.commitment)],
      PROGRAM_ID
    );

    const commitmentArray = toArray32(note.commitment);

    const signature = await program.methods
      .privateDeposit(commitmentArray, new BN(amountLamports))
      .accounts({
        depositor: wallet.publicKey,
        pool: poolPda,
        poolVault: poolVaultPda,
        commitmentPda: commitmentPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Save the note to localStorage for later withdrawal
    saveNote(wallet.publicKey.toString(), note);

    return { signature, note };
  }, [program, wallet]);

  /**
   * Private withdraw with nullifier (ZK-like privacy)
   *
   * PRIVACY FLOW:
   * 1. Load the private note (from localStorage)
   * 2. Provide nullifier = hash(nullifier_secret)
   * 3. Provide secret_hash = hash(secret)
   * 4. Program verifies commitment matches and nullifier not used
   * 5. Creates NullifierPDA (prevents double-spend)
   * 6. Transfers to recipient (stealth address)
   *
   * Result: Withdrawal cannot be linked to deposit by chain analysis
   *
   * @param note - The private note from deposit
   * @param recipient - The recipient public key (typically stealth address)
   * @returns Transaction signature
   */
  const privateWithdraw = useCallback(async (
    note: any,
    recipient: PublicKey
  ): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
    const { BN } = await import('@coral-xyz/anchor');
    const { SystemProgram, PublicKey: PK } = await import('@solana/web3.js');
    const { toArray32, markNoteSpent, toHex } = await import('../privacy');

    // Get the commitment PDA
    const [commitmentPda] = PK.findProgramAddressSync(
      [Buffer.from('commitment'), Buffer.from(note.commitment)],
      PROGRAM_ID
    );

    // Get the nullifier PDA
    const [nullifierPda] = PK.findProgramAddressSync(
      [Buffer.from('nullifier'), Buffer.from(note.nullifier)],
      PROGRAM_ID
    );

    const nullifierArray = toArray32(note.nullifier);
    const secretHashArray = toArray32(note.secretHash);

    const signature = await program.methods
      .privateWithdraw(nullifierArray, secretHashArray, new BN(note.amount))
      .accounts({
        payer: wallet.publicKey,
        recipient: recipient,
        pool: poolPda,
        poolVault: poolVaultPda,
        commitmentPda: commitmentPda,
        nullifierPda: nullifierPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Mark note as spent in localStorage
    markNoteSpent(wallet.publicKey.toString(), toHex(note.commitment));

    return signature;
  }, [program, wallet]);

  /**
   * Private withdraw via relayer (gasless + ZK-like privacy)
   *
   * Combines Phase 2 (gasless) with Phase 3 (commitment privacy)
   * - Relayer pays gas fees
   * - Recipient proves ownership via ed25519 signature
   * - Nullifier prevents double-spend
   *
   * @param note - The private note from deposit
   * @param recipientKeypair - The recipient keypair (for signing)
   * @returns Transaction signature and relayer address
   */
  const privateWithdrawRelayed = useCallback(async (
    note: any,
    recipientKeypair: Keypair
  ): Promise<{ signature: string; relayer: string }> => {
    const { toArray32, markNoteSpent, toHex } = await import('../privacy');
    const { sign } = await import('tweetnacl');
    const bs58 = await import('bs58');

    // Get the commitment PDA
    const { PublicKey: PK } = await import('@solana/web3.js');
    const [commitmentPda] = PK.findProgramAddressSync(
      [Buffer.from('commitment'), Buffer.from(note.commitment)],
      PROGRAM_ID
    );

    // Create message to sign
    const message = Buffer.from(`private_withdraw:${toHex(note.commitment)}`);

    // Sign with recipient keypair
    const signature = sign.detached(message, recipientKeypair.secretKey);
    const signatureBase58 = bs58.default.encode(signature);

    // Call relayer API for private withdraw
    const response = await fetch('/api/relayer/private-claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commitment: toHex(note.commitment),
        nullifier: toHex(note.nullifier),
        secretHash: toHex(note.secretHash),
        amount: note.amount,
        recipient: recipientKeypair.publicKey.toString(),
        signature: signatureBase58,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.details || 'Relayer private claim failed');
    }

    // Mark note as spent
    if (typeof window !== 'undefined') {
      markNoteSpent(recipientKeypair.publicKey.toString(), toHex(note.commitment));
    }

    return {
      signature: result.signature,
      relayer: result.relayer,
    };
  }, []);

  /**
   * Get stored private notes for the connected wallet
   */
  const getPrivateNotes = useCallback(async (): Promise<any[]> => {
    if (!wallet) return [];

    const { getStoredNotes } = await import('../privacy');
    return getStoredNotes(wallet.publicKey.toString());
  }, [wallet]);

  /**
   * Get unspent private notes for the connected wallet
   */
  const getUnspentPrivateNotes = useCallback(async (): Promise<any[]> => {
    if (!wallet) return [];

    const { getUnspentNotes } = await import('../privacy');
    return getUnspentNotes(wallet.publicKey.toString());
  }, [wallet]);

  /**
   * QUICK WITHDRAW TO STEALTH: Saca todas as private notes para o stealth address
   *
   * PRIVACIDADE MÁXIMA: Fundos ficam no stealth address para uso direto.
   * NÃO transfere para carteira principal (isso quebraria a privacidade).
   *
   * @param stealthKeypair - Keypair do stealth address
   * @returns Array of withdrawal signatures
   */
  const quickWithdrawAllToStealth = useCallback(async (
    stealthKeypair: Keypair
  ): Promise<{ note: any; signature: string }[]> => {
    if (!wallet) throw new Error('Wallet not connected');

    const { getUnspentNotes, toArray32, markNoteSpent, toHex } = await import('../privacy');
    const { BN } = await import('@coral-xyz/anchor');
    const { SystemProgram, PublicKey: PK } = await import('@solana/web3.js');

    const notes = await getUnspentNotes(wallet.publicKey.toString());

    if (notes.length === 0) {
      throw new Error('No unspent private notes found');
    }

    const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
    const results: { note: any; signature: string }[] = [];

    for (const note of notes) {
      try {
        const [commitmentPda] = PK.findProgramAddressSync(
          [Buffer.from('commitment'), Buffer.from(note.commitment)],
          PROGRAM_ID
        );

        const [nullifierPda] = PK.findProgramAddressSync(
          [Buffer.from('nullifier'), Buffer.from(note.nullifier)],
          PROGRAM_ID
        );

        const nullifierArray = toArray32(note.nullifier);
        const secretHashArray = toArray32(note.secretHash);

        const signature = await program.methods
          .privateWithdraw(nullifierArray, secretHashArray, new BN(note.amount))
          .accounts({
            payer: wallet.publicKey,
            recipient: stealthKeypair.publicKey,
            pool: poolPda,
            poolVault: poolVaultPda,
            commitmentPda: commitmentPda,
            nullifierPda: nullifierPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        // Mark note as spent
        markNoteSpent(wallet.publicKey.toString(), toHex(note.commitment));

        results.push({ note, signature });
      } catch (err) {
        console.error('Failed to withdraw note:', err);
        // Continue with next note
      }
    }

    return results;
  }, [program, wallet]);

  return {
    // Program instance (for advanced usage)
    program,
    connection,
    wallet,
    isConnected: !!wallet,

    // Read operations
    listCampaigns,
    fetchCampaign,
    fetchCampaignByPda,
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

    // Phase 3: Commitment-based privacy (ZK-like)
    privateDeposit,
    privateWithdraw,
    privateWithdrawRelayed,
    getPrivateNotes,
    getUnspentPrivateNotes,

    // Quick Withdraw to Stealth (privacidade máxima - não transfere pra main)
    quickWithdrawAllToStealth,

    // Constants
    ALLOWED_WITHDRAW_AMOUNTS,
    WITHDRAW_DELAY_SECONDS,
    MIN_DELAY_SECONDS,
    MAX_DELAY_SECONDS,
    CHURN_VAULT_COUNT,

    // Invite operations
    generateInviteCode,
    createInvite,
    acceptInvite,
    revokeInvite,
    fetchInvite,
    listInvitesByBatch,
    listMyInvites,
    listMyCreatedInvites,
    checkIsEmployer,
    checkIsRecipient,
    determineRole,

    // Helpers
    getCampaignPDAs,
    getStealthRegistryPDA,
    getPrivacyPoolPDAs,
    getPendingWithdrawPDA,
    getChurnVaultPDAs,
    getInvitePDA,
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

function parseInviteAccount(account: any): InviteData {
  const statusMap: Record<string, 'Pending' | 'Accepted' | 'Revoked'> = {
    pending: 'Pending',
    accepted: 'Accepted',
    revoked: 'Revoked',
  };

  const statusKey = Object.keys(account.status)[0];

  return {
    batch: account.batch,
    inviteCode: account.inviteCode,
    creator: account.creator,
    recipient: account.recipient,
    recipientStealthAddress: account.recipientStealthAddress,
    status: statusMap[statusKey] || 'Pending',
    createdAt: account.createdAt.toNumber(),
    acceptedAt: account.acceptedAt.toNumber(),
    bump: account.bump,
  };
}
