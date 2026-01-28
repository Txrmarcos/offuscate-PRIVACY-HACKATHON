import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from '@solana/web3.js';
import idlJson from './idl/offuscate.json';
import { getHeliusConnection, isHeliusConfigured } from '../helius';

// Program ID from deployment
export const PROGRAM_ID = new PublicKey('5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq');

// Helius API Key for RPC
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';

// Devnet connection - PRIORITIZES HELIUS RPC for enhanced features
export const DEVNET_RPC = HELIUS_API_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : (process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com');

/**
 * Get connection instance - uses Helius if configured
 * Helius RPC provides:
 * - Enhanced transaction parsing
 * - Priority fee estimation
 * - Better reliability
 */
export function getConnection(): Connection {
  if (isHeliusConfigured()) {
    return getHeliusConnection();
  }
  return new Connection(DEVNET_RPC, 'confirmed');
}

// IDL type
const idl = idlJson as Idl;

// ============================================
// TYPES
// ============================================

export interface CampaignData {
  owner: PublicKey;
  campaignId: string;
  title: string;
  description: string;
  goal: number;
  totalRaised: number;
  donorCount: number;
  deadline: number;
  status: 'Active' | 'Closed' | 'Completed';
  createdAt: number;
  vaultBump: number;
  campaignBump: number;
  stealthMetaAddress: string;
  stealthDonations: number;
  stealthTotal: number;
}

export interface StealthRegistryData {
  campaign: PublicKey;
  stealthAddress: PublicKey;
  ephemeralPubKey: string;
  amount: number;
  timestamp: number;
  bump: number;
}

// Privacy Pool types
export interface PrivacyPoolData {
  totalDeposited: number;
  totalWithdrawn: number;
  depositCount: number;
  withdrawCount: number;
  churnCount: number;
  currentBalance: number;
  bump: number;
  vaultBump: number;
}

export interface ChurnVaultData {
  index: number;
  bump: number;
  balance: number;
}

export interface PendingWithdrawData {
  recipient: PublicKey;
  amount: number;
  requestedAt: number;
  availableAt: number;
  claimed: boolean;
  bump: number;
  timeRemaining: number; // Seconds until claimable
  isReady: boolean;
}

// Invite types
export type InviteStatus = 'Pending' | 'Accepted' | 'Revoked';

export interface InviteData {
  batch: PublicKey;
  inviteCode: string;
  creator: PublicKey;
  recipient: PublicKey;
  recipientStealthAddress: string;
  salaryRate: number;           // lamports per second (0 = no streaming)
  status: InviteStatus;
  createdAt: number;
  acceptedAt: number;
  bump: number;
  // Computed for display
  monthlySalary?: number;       // salary_rate * 30 days in SOL
}

// ============================================
// INDEX-BASED STREAMING PAYROLL TYPES
// ============================================

export interface MasterVaultData {
  authority: PublicKey;
  batchCount: number;
  totalEmployees: number;
  totalDeposited: number;
  totalPaid: number;
  bump: number;
}

export type BatchStatus = 'Active' | 'Paused' | 'Closed';

export interface PayrollBatchData {
  masterVault: PublicKey;
  owner: PublicKey;
  index: number;
  title: string;
  employeeCount: number;
  totalBudget: number;
  totalPaid: number;
  createdAt: number;
  status: BatchStatus;
  vaultBump: number;
  batchBump: number;
}

export type EmployeeStatus = 'Active' | 'Paused' | 'Terminated';

export interface EmployeeData {
  batch: PublicKey;
  wallet: PublicKey;
  index: number;
  stealthAddress: string;
  salaryRate: number;        // lamports per second
  startTime: number;
  lastClaimedAt: number;
  totalClaimed: number;
  status: EmployeeStatus;
  bump: number;
  // Computed fields
  accruedSalary?: number;    // current unclaimed amount
  monthlySalary?: number;    // salary_rate * 30 days (for display)
}

// ============================================
// ANONYMOUS RECEIPTS TYPES
// ============================================

export interface PaymentReceiptData {
  employee: PublicKey;
  batch: PublicKey;
  employer: PublicKey;
  commitment: Uint8Array;    // 32 bytes - hides amount
  timestamp: number;
  receiptIndex: number;
  bump: number;
}

export interface ReceiptProof {
  employeeWallet: PublicKey;
  batchKey: PublicKey;
  timestamp: number;
  amount: number;            // Only revealed for full verification
  secret: Uint8Array;        // 32 bytes - kept by employee
}

// Allowed withdrawal amounts (must match Anchor program)
export const ALLOWED_WITHDRAW_AMOUNTS = [0.1, 0.5, 1.0]; // SOL

// Delay constants (variable delay: 30s - 5min)
export const MIN_DELAY_SECONDS = 30;
export const MAX_DELAY_SECONDS = 300;
export const WITHDRAW_DELAY_SECONDS = MIN_DELAY_SECONDS; // Legacy - use variable delay

// Churn vault count
export const CHURN_VAULT_COUNT = 3;

// ============================================
// PROGRAM HELPERS
// ============================================

/**
 * Create Anchor Program instance
 */
export function getProgram(provider: AnchorProvider): Program {
  return new Program(idl, provider);
}

/**
 * Create a read-only provider (no wallet needed)
 */
export function getReadOnlyProvider(connection: Connection): AnchorProvider {
  // Dummy wallet for read-only operations
  const dummyWallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async () => { throw new Error('Read-only'); },
    signAllTransactions: async () => { throw new Error('Read-only'); },
  };
  return new AnchorProvider(connection, dummyWallet as any, {});
}

/**
 * Get PDAs for a campaign
 */
export function getCampaignPDAs(campaignId: string) {
  const [campaignPda, campaignBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('campaign'), Buffer.from(campaignId)],
    PROGRAM_ID
  );

  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), Buffer.from(campaignId)],
    PROGRAM_ID
  );

  return { campaignPda, vaultPda, campaignBump, vaultBump };
}

/**
 * Get PDA for stealth registry entry
 */
export function getStealthRegistryPDA(campaignPda: PublicKey, stealthAddress: PublicKey) {
  const [registryPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('stealth'), campaignPda.toBuffer(), stealthAddress.toBuffer()],
    PROGRAM_ID
  );
  return { registryPda, bump };
}

/**
 * Get PDAs for Privacy Pool
 */
export function getPrivacyPoolPDAs() {
  const [poolPda, poolBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('privacy_pool')],
    PROGRAM_ID
  );

  const [poolVaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool_vault')],
    PROGRAM_ID
  );

  return { poolPda, poolVaultPda, poolBump, vaultBump };
}

/**
 * Get PDA for pending withdrawal
 */
export function getPendingWithdrawPDA(recipient: PublicKey) {
  const [pendingPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('pending'), recipient.toBuffer()],
    PROGRAM_ID
  );
  return { pendingPda, bump };
}

/**
 * Get PDAs for churn vault
 */
export function getChurnVaultPDAs(index: number) {
  const indexBuffer = Buffer.from([index]);

  const [churnStatePda, stateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('churn_state'), indexBuffer],
    PROGRAM_ID
  );

  const [churnVaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('churn_vault'), indexBuffer],
    PROGRAM_ID
  );

  return { churnStatePda, churnVaultPda, stateBump, vaultBump };
}

/**
 * Get PDA for invite
 */
export function getInvitePDA(inviteCode: string) {
  const [invitePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('invite'), Buffer.from(inviteCode)],
    PROGRAM_ID
  );
  return { invitePda, bump };
}

// ============================================
// INDEX-BASED STREAMING PAYROLL PDAs
// ============================================

export function getMasterVaultPDA() {
  const [masterVaultPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('master_vault')],
    PROGRAM_ID
  );
  return { masterVaultPda, bump };
}

export function getBatchPDA(masterVaultPda: PublicKey, index: number) {
  const indexBuffer = Buffer.alloc(4);
  indexBuffer.writeUInt32LE(index);

  const [batchPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('batch'), masterVaultPda.toBuffer(), indexBuffer],
    PROGRAM_ID
  );
  return { batchPda, bump };
}

export function getBatchVaultPDA(batchPda: PublicKey) {
  const [batchVaultPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('batch_vault'), batchPda.toBuffer()],
    PROGRAM_ID
  );
  return { batchVaultPda, bump };
}

export function getEmployeePDA(batchPda: PublicKey, index: number) {
  const indexBuffer = Buffer.alloc(4);
  indexBuffer.writeUInt32LE(index);

  const [employeePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('employee'), batchPda.toBuffer(), indexBuffer],
    PROGRAM_ID
  );
  return { employeePda, bump };
}

// ============================================
// ANONYMOUS RECEIPTS PDAs
// ============================================

export function getReceiptPDA(employeeWallet: PublicKey, batchPda: PublicKey, totalClaimed: number) {
  // Write u64 in little-endian format (browser-compatible)
  const totalClaimedBuffer = new Uint8Array(8);
  let value = BigInt(totalClaimed);
  for (let i = 0; i < 8; i++) {
    totalClaimedBuffer[i] = Number(value & BigInt(0xff));
    value = value >> BigInt(8);
  }

  const [receiptPda, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('receipt'),
      employeeWallet.toBuffer(),
      batchPda.toBuffer(),
      Buffer.from(totalClaimedBuffer),
    ],
    PROGRAM_ID
  );
  return { receiptPda, bump };
}

// ============================================
// CAMPAIGN OPERATIONS
// ============================================

/**
 * Create a new campaign
 */
export async function createCampaign(
  program: Program,
  owner: PublicKey,
  campaignId: string,
  title: string,
  description: string,
  goalSol: number,
  deadlineTimestamp: number
): Promise<string> {
  const { campaignPda, vaultPda } = getCampaignPDAs(campaignId);
  const goalLamports = new BN(goalSol * LAMPORTS_PER_SOL);

  const signature = await program.methods
    .createCampaign(campaignId, title, description, goalLamports, new BN(deadlineTimestamp))
    .accounts({
      owner,
      campaign: campaignPda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Donate to a campaign (regular - goes to vault)
 */
export async function donate(
  program: Program,
  donor: PublicKey,
  campaignId: string,
  amountSol: number
): Promise<string> {
  const { campaignPda, vaultPda } = getCampaignPDAs(campaignId);
  const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

  const signature = await program.methods
    .donate(amountLamports)
    .accounts({
      donor,
      campaign: campaignPda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Withdraw from campaign vault
 */
export async function withdraw(
  program: Program,
  owner: PublicKey,
  campaignId: string,
  amountSol: number
): Promise<string> {
  const { campaignPda, vaultPda } = getCampaignPDAs(campaignId);
  const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

  const signature = await program.methods
    .withdraw(amountLamports)
    .accounts({
      owner,
      campaign: campaignPda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Close a campaign
 */
export async function closeCampaign(
  program: Program,
  owner: PublicKey,
  campaignId: string
): Promise<string> {
  const { campaignPda } = getCampaignPDAs(campaignId);

  const signature = await program.methods
    .closeCampaign()
    .accounts({
      owner,
      campaign: campaignPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

// ============================================
// STEALTH OPERATIONS
// ============================================

/**
 * Set stealth meta-address for a campaign
 */
export async function setStealthMetaAddress(
  program: Program,
  owner: PublicKey,
  campaignId: string,
  stealthMetaAddress: string
): Promise<string> {
  const { campaignPda } = getCampaignPDAs(campaignId);

  const signature = await program.methods
    .setStealthMetaAddress(stealthMetaAddress)
    .accounts({
      owner,
      campaign: campaignPda,
    })
    .rpc();

  return signature;
}

/**
 * Register a stealth payment (metadata only)
 * The actual SOL transfer happens separately via SystemProgram
 */
export async function registerStealthPayment(
  program: Program,
  donor: PublicKey,
  campaignId: string,
  stealthAddress: PublicKey,
  ephemeralPubKey: string,
  amountSol: number
): Promise<string> {
  const { campaignPda } = getCampaignPDAs(campaignId);
  const { registryPda } = getStealthRegistryPDA(campaignPda, stealthAddress);
  const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

  const signature = await program.methods
    .registerStealthPayment(stealthAddress, ephemeralPubKey, amountLamports)
    .accounts({
      donor,
      campaign: campaignPda,
      registry: registryPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

// ============================================
// PRIVACY POOL OPERATIONS
// ============================================

/**
 * Initialize the global privacy pool (called once)
 */
export async function initPrivacyPool(
  program: Program,
  authority: PublicKey
): Promise<string> {
  const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();

  const signature = await program.methods
    .initPrivacyPool()
    .accounts({
      authority,
      pool: poolPda,
      poolVault: poolVaultPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Deposit SOL into the privacy pool
 * PRIVACY: No tracking of sender, receiver, or campaign
 */
export async function poolDeposit(
  program: Program,
  depositor: PublicKey,
  amountSol: number
): Promise<string> {
  const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
  const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

  const signature = await program.methods
    .poolDeposit(amountLamports)
    .accounts({
      depositor,
      pool: poolPda,
      poolVault: poolVaultPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Request a withdrawal from the privacy pool
 * Amount must be one of: 0.1, 0.5, or 1.0 SOL
 * Creates a pending withdrawal with delay
 */
export async function requestWithdraw(
  program: Program,
  recipient: PublicKey,
  amountSol: number
): Promise<string> {
  // Validate amount is allowed
  if (!ALLOWED_WITHDRAW_AMOUNTS.includes(amountSol)) {
    throw new Error(`Invalid amount. Must be one of: ${ALLOWED_WITHDRAW_AMOUNTS.join(', ')} SOL`);
  }

  const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
  const { pendingPda } = getPendingWithdrawPDA(recipient);
  const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

  const signature = await program.methods
    .requestWithdraw(amountLamports)
    .accounts({
      recipient,
      pool: poolPda,
      poolVault: poolVaultPda,
      pendingWithdraw: pendingPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Claim a pending withdrawal after delay has passed
 * Must be signed by the recipient (stealth keypair)
 */
export async function claimWithdraw(
  program: Program,
  recipient: PublicKey
): Promise<string> {
  const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
  const { pendingPda } = getPendingWithdrawPDA(recipient);

  const signature = await program.methods
    .claimWithdraw()
    .accounts({
      recipient,
      pool: poolPda,
      poolVault: poolVaultPda,
      pendingWithdraw: pendingPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Fetch privacy pool stats
 */
export async function fetchPoolStats(
  program: Program,
  connection: Connection
): Promise<PrivacyPoolData | null> {
  const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();

  try {
    const account = await (program.account as any).privacyPool.fetch(poolPda);
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
}

/**
 * Fetch pending withdrawal for a recipient
 */
export async function fetchPendingWithdraw(
  program: Program,
  recipient: PublicKey
): Promise<PendingWithdrawData | null> {
  const { pendingPda } = getPendingWithdrawPDA(recipient);

  try {
    const account = await (program.account as any).pendingWithdraw.fetch(pendingPda);
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
}

/**
 * Check if privacy pool is initialized
 */
export async function isPoolInitialized(program: Program): Promise<boolean> {
  const stats = await fetchPoolStats(program, program.provider.connection);
  return stats !== null;
}

// ============================================
// POOL CHURN OPERATIONS
// ============================================

/**
 * Initialize a churn vault (called once per vault index 0-2)
 */
export async function initChurnVault(
  program: Program,
  authority: PublicKey,
  index: number
): Promise<string> {
  const { poolPda } = getPrivacyPoolPDAs();
  const { churnStatePda, churnVaultPda } = getChurnVaultPDAs(index);

  const signature = await program.methods
    .initChurnVault(index)
    .accounts({
      authority,
      pool: poolPda,
      churnVaultState: churnStatePda,
      churnVault: churnVaultPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Pool Churn - Move funds to internal churn vault (breaks graph heuristics)
 */
export async function poolChurn(
  program: Program,
  authority: PublicKey,
  index: number,
  amountSol: number
): Promise<string> {
  const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
  const { churnStatePda, churnVaultPda } = getChurnVaultPDAs(index);
  const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

  const signature = await program.methods
    .poolChurn(amountLamports)
    .accounts({
      authority,
      pool: poolPda,
      poolVault: poolVaultPda,
      churnVaultState: churnStatePda,
      churnVault: churnVaultPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Pool Unchurn - Return funds from churn vault to main pool
 */
export async function poolUnchurn(
  program: Program,
  authority: PublicKey,
  index: number,
  amountSol: number
): Promise<string> {
  const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();
  const { churnStatePda, churnVaultPda } = getChurnVaultPDAs(index);
  const amountLamports = new BN(amountSol * LAMPORTS_PER_SOL);

  const signature = await program.methods
    .poolUnchurn(amountLamports)
    .accounts({
      authority,
      pool: poolPda,
      poolVault: poolVaultPda,
      churnVaultState: churnStatePda,
      churnVault: churnVaultPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * BATCH CLAIM WITHDRAWALS
 *
 * PRIVACY FEATURE: Processes multiple pending withdrawals in a single transaction.
 * This breaks the visual pattern of "1 withdraw = 1 tx" that analysts use for correlation.
 *
 * @param program - Anchor program instance
 * @param authority - Signer who authorizes the batch claim
 * @param recipients - Array of recipient keypairs (stealth addresses) with pending withdrawals
 * @returns Transaction signature
 */
export async function batchClaimWithdraw(
  program: Program,
  authority: PublicKey,
  recipients: Keypair[]
): Promise<string> {
  if (recipients.length === 0) {
    throw new Error('No recipients provided for batch claim');
  }
  if (recipients.length > 5) {
    throw new Error('Maximum 5 withdrawals per batch');
  }

  const { poolPda, poolVaultPda } = getPrivacyPoolPDAs();

  // Build remaining accounts array: pairs of (pending_pda, recipient)
  const remainingAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];

  for (const recipient of recipients) {
    const { pendingPda } = getPendingWithdrawPDA(recipient.publicKey);

    // Add pending withdraw PDA (writable, not signer)
    remainingAccounts.push({
      pubkey: pendingPda,
      isSigner: false,
      isWritable: true,
    });

    // Add recipient (writable to receive SOL, signer for verification)
    remainingAccounts.push({
      pubkey: recipient.publicKey,
      isSigner: false, // Authority signs, not individual recipients
      isWritable: true,
    });
  }

  const signature = await program.methods
    .batchClaimWithdraw()
    .accounts({
      authority,
      pool: poolPda,
      poolVault: poolVaultPda,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .rpc();

  return signature;
}

/**
 * Fetch all pending withdrawals that are ready to claim
 * Useful for batch operations
 */
export async function fetchReadyWithdrawals(
  program: Program,
): Promise<{ recipient: PublicKey; pendingPda: PublicKey; amount: number }[]> {
  try {
    const accounts = await (program.account as any).pendingWithdraw.all();
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
}

/**
 * Fetch churn vault state
 */
export async function fetchChurnVault(
  program: Program,
  connection: Connection,
  index: number
): Promise<ChurnVaultData | null> {
  const { churnStatePda, churnVaultPda } = getChurnVaultPDAs(index);

  try {
    const account = await (program.account as any).churnVaultState.fetch(churnStatePda);
    const balance = await connection.getBalance(churnVaultPda);

    return {
      index: account.index,
      bump: account.bump,
      balance: balance / LAMPORTS_PER_SOL,
    };
  } catch {
    return null;
  }
}

// ============================================
// FETCH OPERATIONS
// ============================================

/**
 * Fetch vault balance
 */
export async function fetchVaultBalance(
  connection: Connection,
  campaignId: string
): Promise<number> {
  const { vaultPda } = getCampaignPDAs(campaignId);
  const balance = await connection.getBalance(vaultPda);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Fetch a single campaign
 */
export async function fetchCampaign(
  program: Program,
  campaignId: string
): Promise<CampaignData | null> {
  const { campaignPda } = getCampaignPDAs(campaignId);

  try {
    const account = await (program.account as any).campaign.fetch(campaignPda);
    return parseCampaignAccount(account);
  } catch {
    return null;
  }
}

/**
 * List all campaigns
 */
export async function listCampaigns(
  program: Program
): Promise<{ pubkey: PublicKey; account: CampaignData }[]> {
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
}

/**
 * Fetch stealth registries for a campaign
 */
export async function fetchStealthRegistries(
  program: Program,
  campaignPda: PublicKey
): Promise<StealthRegistryData[]> {
  try {
    const accounts = await (program.account as any).stealthRegistry.all([
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: campaignPda.toBase58(),
        },
      },
    ]);

    return accounts.map(({ account }: any) => parseStealthRegistryAccount(account));
  } catch (e) {
    console.error('Failed to fetch stealth registries:', e);
    return [];
  }
}

// ============================================
// INVITE OPERATIONS
// ============================================

/**
 * Create an invite for a recipient to join a payroll batch
 * @param salaryRate - lamports per second (0 = no streaming, just invite)
 */
export async function createInvite(
  program: Program,
  owner: PublicKey,
  campaignId: string,
  inviteCode: string,
  salaryRate: number = 0
): Promise<string> {
  const { campaignPda } = getCampaignPDAs(campaignId);
  const { invitePda } = getInvitePDA(inviteCode);

  const signature = await program.methods
    .createInvite(inviteCode, new BN(salaryRate))
    .accounts({
      owner,
      campaign: campaignPda,
      invite: invitePda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Accept an invite and register stealth address (simple version, no streaming)
 */
export async function acceptInvite(
  program: Program,
  recipient: PublicKey,
  inviteCode: string,
  stealthMetaAddress: string
): Promise<string> {
  const { invitePda } = getInvitePDA(inviteCode);

  const signature = await program.methods
    .acceptInvite(stealthMetaAddress)
    .accounts({
      recipient,
      invite: invitePda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Accept invite AND automatically add to streaming payroll
 *
 * PRIVACY FLOW:
 * 1. Employee generates a stealth keypair LOCALLY
 * 2. Passes the stealth PUBLIC KEY as employeeStealthPubkey
 * 3. Employee account is created with wallet = stealth pubkey
 * 4. Employee keeps stealth PRIVATE KEY locally
 * 5. To claim salary, employee signs with stealth keypair
 *
 * @param payer - Who pays for the transaction (can be main wallet)
 * @param employeeStealthPubkey - The PUBLIC KEY of locally generated stealth keypair
 * @param inviteCode - The invite code
 * @param stealthMetaAddress - Stealth meta address for receiving payments
 * @param batchPda - The payroll batch PDA
 * @param masterVaultPda - The master vault PDA
 */
export async function acceptInviteStreaming(
  program: Program,
  payer: PublicKey,
  employeeStealthPubkey: PublicKey,
  inviteCode: string,
  stealthMetaAddress: string,
  batchPda: PublicKey,
  masterVaultPda: PublicKey,
  batchEmployeeCount: number
): Promise<string> {
  const { invitePda } = getInvitePDA(inviteCode);

  // Derive employee PDA using current employee count
  const { employeePda } = getEmployeePDA(batchPda, batchEmployeeCount);

  const signature = await program.methods
    .acceptInviteStreaming(stealthMetaAddress)
    .accounts({
      payer,
      employeeStealthPubkey,
      invite: invitePda,
      masterVault: masterVaultPda,
      batch: batchPda,
      employee: employeePda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Revoke an invite (only creator can revoke)
 */
export async function revokeInvite(
  program: Program,
  owner: PublicKey,
  inviteCode: string
): Promise<string> {
  const { invitePda } = getInvitePDA(inviteCode);

  const signature = await program.methods
    .revokeInvite()
    .accounts({
      owner,
      invite: invitePda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * Fetch an invite by code
 */
export async function fetchInvite(
  program: Program,
  inviteCode: string
): Promise<InviteData | null> {
  const { invitePda } = getInvitePDA(inviteCode);

  try {
    const account = await (program.account as any).invite.fetch(invitePda);
    return parseInviteAccount(account);
  } catch {
    return null;
  }
}

/**
 * List all invites for a campaign (batch)
 */
export async function listInvitesByBatch(
  program: Program,
  campaignPda: PublicKey
): Promise<{ pubkey: PublicKey; account: InviteData }[]> {
  try {
    const accounts = await (program.account as any).invite.all([
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: campaignPda.toBase58(),
        },
      },
    ]);

    return accounts.map(({ publicKey, account }: any) => ({
      pubkey: publicKey,
      account: parseInviteAccount(account),
    }));
  } catch (e) {
    console.error('Failed to list invites:', e);
    return [];
  }
}

/**
 * List all invites where wallet is the recipient
 */
export async function listMyInvites(
  program: Program,
  recipientWallet: PublicKey
): Promise<{ pubkey: PublicKey; account: InviteData }[]> {
  try {
    const accounts = await (program.account as any).invite.all([
      {
        memcmp: {
          offset: 8 + 32 + (4 + 16) + 32, // batch + invite_code + creator
          bytes: recipientWallet.toBase58(),
        },
      },
    ]);

    return accounts.map(({ publicKey, account }: any) => ({
      pubkey: publicKey,
      account: parseInviteAccount(account),
    }));
  } catch (e) {
    console.error('Failed to list my invites:', e);
    return [];
  }
}

/**
 * List all invites created by a wallet (employer)
 */
export async function listInvitesByCreator(
  program: Program,
  creatorWallet: PublicKey
): Promise<{ pubkey: PublicKey; account: InviteData }[]> {
  try {
    const accounts = await (program.account as any).invite.all([
      {
        memcmp: {
          offset: 8 + 32 + (4 + 16), // batch + invite_code
          bytes: creatorWallet.toBase58(),
        },
      },
    ]);

    return accounts.map(({ publicKey, account }: any) => ({
      pubkey: publicKey,
      account: parseInviteAccount(account),
    }));
  } catch (e) {
    console.error('Failed to list invites by creator:', e);
    return [];
  }
}

// ============================================
// ACCOUNT PARSERS
// ============================================

function parseInviteAccount(account: any): InviteData {
  const statusMap: Record<string, InviteStatus> = {
    pending: 'Pending',
    accepted: 'Accepted',
    revoked: 'Revoked',
  };

  const statusKey = Object.keys(account.status)[0];
  const salaryRate = account.salaryRate?.toNumber?.() ?? 0;

  return {
    batch: account.batch,
    inviteCode: account.inviteCode,
    creator: account.creator,
    recipient: account.recipient,
    recipientStealthAddress: account.recipientStealthAddress,
    salaryRate,
    status: statusMap[statusKey] || 'Pending',
    createdAt: account.createdAt.toNumber(),
    acceptedAt: account.acceptedAt.toNumber(),
    bump: account.bump,
    // Computed: monthly salary in SOL
    monthlySalary: salaryRate > 0 ? (salaryRate * 30 * 24 * 60 * 60) / LAMPORTS_PER_SOL : 0,
  };
}

function parseCampaignAccount(account: any): CampaignData {
  const statusMap: Record<string, 'Active' | 'Closed' | 'Completed'> = {
    active: 'Active',
    closed: 'Closed',
    completed: 'Completed',
  };

  // Get status key (Anchor returns { active: {} } format)
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
  return {
    campaign: account.campaign,
    stealthAddress: account.stealthAddress,
    ephemeralPubKey: account.ephemeralPubKey,
    amount: account.amount.toNumber() / LAMPORTS_PER_SOL,
    timestamp: account.timestamp.toNumber(),
    bump: account.bump,
  };
}

// ============================================
// ANONYMOUS RECEIPTS OPERATIONS
// ============================================

/**
 * Generate a random 32-byte secret for receipt creation
 */
export function generateReceiptSecret(): Uint8Array {
  const secret = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(secret);
  } else {
    // Node.js fallback
    for (let i = 0; i < 32; i++) {
      secret[i] = Math.floor(Math.random() * 256);
    }
  }
  return secret;
}

/**
 * Create an anonymous receipt after claiming salary
 * Returns the secret that must be stored locally for later verification
 */
export async function createReceipt(
  program: Program,
  employeeSigner: PublicKey,
  employeePda: PublicKey,
  batchPda: PublicKey,
  totalClaimed: number,
  secret?: Uint8Array
): Promise<{ signature: string; secret: Uint8Array }> {
  const receiptSecret = secret || generateReceiptSecret();
  const { receiptPda } = getReceiptPDA(employeeSigner, batchPda, totalClaimed);

  const signature = await program.methods
    .createReceipt(Array.from(receiptSecret))
    .accounts({
      employeeSigner,
      employee: employeePda,
      batch: batchPda,
      receipt: receiptPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { signature, secret: receiptSecret };
}

/**
 * Verify an anonymous receipt with full proof (reveals amount)
 * Used for complete audits
 */
export async function verifyReceipt(
  program: Program,
  verifier: PublicKey,
  receiptPda: PublicKey,
  proof: ReceiptProof
): Promise<string> {
  const signature = await program.methods
    .verifyReceipt(
      proof.employeeWallet,
      proof.batchKey,
      new BN(proof.timestamp),
      new BN(proof.amount * LAMPORTS_PER_SOL),
      Array.from(proof.secret)
    )
    .accounts({
      verifier,
      receipt: receiptPda,
    })
    .rpc();

  return signature;
}

/**
 * Verify an anonymous receipt without revealing amount (blind verification)
 * Proves: "This employee received payment from this employer"
 * Does NOT prove: the specific amount
 */
export async function verifyReceiptBlind(
  program: Program,
  verifier: PublicKey,
  receiptPda: PublicKey,
  employeeWallet: PublicKey,
  timestampRangeStart: number,
  timestampRangeEnd: number
): Promise<string> {
  const signature = await program.methods
    .verifyReceiptBlind(
      employeeWallet,
      new BN(timestampRangeStart),
      new BN(timestampRangeEnd)
    )
    .accounts({
      verifier,
      receipt: receiptPda,
    })
    .rpc();

  return signature;
}

/**
 * Fetch a payment receipt by PDA
 */
export async function fetchReceipt(
  program: Program,
  receiptPda: PublicKey
): Promise<PaymentReceiptData | null> {
  try {
    const account = await (program.account as any).paymentReceipt.fetch(receiptPda);
    return parseReceiptAccount(account);
  } catch {
    return null;
  }
}

/**
 * List all receipts for an employee
 */
export async function listEmployeeReceipts(
  program: Program,
  employeeWallet: PublicKey
): Promise<{ pubkey: PublicKey; account: PaymentReceiptData }[]> {
  try {
    const accounts = await (program.account as any).paymentReceipt.all([
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: employeeWallet.toBase58(),
        },
      },
    ]);

    return accounts.map(({ publicKey, account }: any) => ({
      pubkey: publicKey,
      account: parseReceiptAccount(account),
    }));
  } catch (e) {
    console.error('Failed to list receipts:', e);
    return [];
  }
}

/**
 * List all receipts from a specific employer
 */
export async function listReceiptsByEmployer(
  program: Program,
  employerWallet: PublicKey
): Promise<{ pubkey: PublicKey; account: PaymentReceiptData }[]> {
  try {
    const accounts = await (program.account as any).paymentReceipt.all([
      {
        memcmp: {
          offset: 8 + 32 + 32, // employee + batch
          bytes: employerWallet.toBase58(),
        },
      },
    ]);

    return accounts.map(({ publicKey, account }: any) => ({
      pubkey: publicKey,
      account: parseReceiptAccount(account),
    }));
  } catch (e) {
    console.error('Failed to list receipts by employer:', e);
    return [];
  }
}

function parseReceiptAccount(account: any): PaymentReceiptData {
  return {
    employee: account.employee,
    batch: account.batch,
    employer: account.employer,
    commitment: new Uint8Array(account.commitment),
    timestamp: account.timestamp.toNumber(),
    receiptIndex: account.receiptIndex.toNumber(),
    bump: account.bump,
  };
}
