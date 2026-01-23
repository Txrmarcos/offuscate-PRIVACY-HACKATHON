import { BN } from '@coral-xyz/anchor';
import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from '@solana/web3.js';
import bs58 from 'bs58';

// Program ID from deployment
export const PROGRAM_ID = new PublicKey('5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq');

// Devnet connection
export const DEVNET_RPC = 'https://api.devnet.solana.com';

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
}

// Instruction discriminators (first 8 bytes of sha256 hash of instruction name)
const DISCRIMINATORS = {
  createCampaign: Buffer.from([111, 131, 187, 98, 160, 193, 114, 244]),
  donate: Buffer.from([121, 186, 218, 211, 73, 70, 196, 180]),
  withdraw: Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]),
  closeCampaign: Buffer.from([65, 49, 110, 7, 63, 238, 206, 77]),
};

// Get PDAs for a campaign
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

// Serialize string for Borsh (length-prefixed)
function serializeString(str: string): Buffer {
  const strBytes = Buffer.from(str, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(strBytes.length, 0);
  return Buffer.concat([lenBuf, strBytes]);
}

// Serialize u64 for Borsh
function serializeU64(value: number | BN): Buffer {
  const bn = typeof value === 'number' ? new BN(value) : value;
  return bn.toArrayLike(Buffer, 'le', 8);
}

// Serialize i64 for Borsh
function serializeI64(value: number | BN): Buffer {
  const bn = typeof value === 'number' ? new BN(value) : value;
  return bn.toArrayLike(Buffer, 'le', 8);
}

// Create campaign instruction
export function createCampaignInstruction(
  owner: PublicKey,
  campaignId: string,
  title: string,
  description: string,
  goalLamports: number | BN,
  deadlineTimestamp: number | BN
): TransactionInstruction {
  const { campaignPda, vaultPda } = getCampaignPDAs(campaignId);

  const data = Buffer.concat([
    DISCRIMINATORS.createCampaign,
    serializeString(campaignId),
    serializeString(title),
    serializeString(description),
    serializeU64(goalLamports),
    serializeI64(deadlineTimestamp),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: campaignPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// Donate instruction
export function donateInstruction(
  donor: PublicKey,
  campaignId: string,
  amountLamports: number | BN
): TransactionInstruction {
  const { campaignPda, vaultPda } = getCampaignPDAs(campaignId);

  const data = Buffer.concat([
    DISCRIMINATORS.donate,
    serializeU64(amountLamports),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: donor, isSigner: true, isWritable: true },
      { pubkey: campaignPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// Withdraw instruction
export function withdrawInstruction(
  owner: PublicKey,
  campaignId: string,
  amountLamports: number | BN
): TransactionInstruction {
  const { campaignPda, vaultPda } = getCampaignPDAs(campaignId);

  const data = Buffer.concat([
    DISCRIMINATORS.withdraw,
    serializeU64(amountLamports),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: campaignPda, isSigner: false, isWritable: false },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// Close campaign instruction
export function closeCampaignInstruction(
  owner: PublicKey,
  campaignId: string
): TransactionInstruction {
  const { campaignPda } = getCampaignPDAs(campaignId);

  return new TransactionInstruction({
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: campaignPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: DISCRIMINATORS.closeCampaign,
  });
}

// Fetch vault balance
export async function fetchVaultBalance(
  connection: Connection,
  campaignId: string
): Promise<number> {
  const { vaultPda } = getCampaignPDAs(campaignId);
  const balance = await connection.getBalance(vaultPda);
  return balance / LAMPORTS_PER_SOL;
}

// Account discriminator for Campaign (first 8 bytes)
const CAMPAIGN_DISCRIMINATOR = Buffer.from([50, 40, 49, 11, 157, 220, 229, 192]);

// Deserialize campaign data from account
export function deserializeCampaign(data: Buffer): CampaignData | null {
  try {
    // Check discriminator
    if (!data.slice(0, 8).equals(CAMPAIGN_DISCRIMINATOR)) {
      return null;
    }

    let offset = 8;

    // Owner (32 bytes)
    const owner = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Campaign ID (string)
    const campaignIdLen = data.readUInt32LE(offset);
    offset += 4;
    const campaignId = data.slice(offset, offset + campaignIdLen).toString('utf8');
    offset += campaignIdLen;

    // Title (string)
    const titleLen = data.readUInt32LE(offset);
    offset += 4;
    const title = data.slice(offset, offset + titleLen).toString('utf8');
    offset += titleLen;

    // Description (string)
    const descLen = data.readUInt32LE(offset);
    offset += 4;
    const description = data.slice(offset, offset + descLen).toString('utf8');
    offset += descLen;

    // Goal (u64)
    const goal = Number(new BN(data.slice(offset, offset + 8), 'le'));
    offset += 8;

    // Total raised (u64)
    const totalRaised = Number(new BN(data.slice(offset, offset + 8), 'le'));
    offset += 8;

    // Donor count (u64)
    const donorCount = Number(new BN(data.slice(offset, offset + 8), 'le'));
    offset += 8;

    // Deadline (i64)
    const deadline = Number(new BN(data.slice(offset, offset + 8), 'le'));
    offset += 8;

    // Status (enum, 1 byte)
    const statusByte = data[offset];
    const status = statusByte === 0 ? 'Active' : statusByte === 1 ? 'Closed' : 'Completed';
    offset += 1;

    // Created at (i64)
    const createdAt = Number(new BN(data.slice(offset, offset + 8), 'le'));
    offset += 8;

    // Vault bump (u8)
    const vaultBump = data[offset];
    offset += 1;

    // Campaign bump (u8)
    const campaignBump = data[offset];

    return {
      owner,
      campaignId,
      title,
      description,
      goal: goal / LAMPORTS_PER_SOL,
      totalRaised: totalRaised / LAMPORTS_PER_SOL,
      donorCount,
      deadline,
      status,
      createdAt,
      vaultBump,
      campaignBump,
    };
  } catch (e) {
    console.error('Failed to deserialize campaign:', e);
    return null;
  }
}

// Fetch campaign data
export async function fetchCampaign(
  connection: Connection,
  campaignId: string
): Promise<CampaignData | null> {
  const { campaignPda } = getCampaignPDAs(campaignId);

  try {
    const accountInfo = await connection.getAccountInfo(campaignPda);
    if (!accountInfo) return null;

    return deserializeCampaign(Buffer.from(accountInfo.data));
  } catch {
    return null;
  }
}

// List all campaigns
export async function listCampaigns(
  connection: Connection
): Promise<{ pubkey: PublicKey; account: CampaignData }[]> {
  try {
    // Use bs58 encoding for the discriminator filter
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(CAMPAIGN_DISCRIMINATOR),
          },
        },
      ],
    });

    const campaigns: { pubkey: PublicKey; account: CampaignData }[] = [];

    for (const { pubkey, account } of accounts) {
      const data = deserializeCampaign(Buffer.from(account.data));
      if (data) {
        campaigns.push({ pubkey, account: data });
      }
    }

    return campaigns;
  } catch (e) {
    console.error('Failed to list campaigns:', e);
    return [];
  }
}
