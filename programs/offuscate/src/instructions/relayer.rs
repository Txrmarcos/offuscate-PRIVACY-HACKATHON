//! Relayer Account Contexts
//!
//! Gasless operations via relayer

use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions as instructions_sysvar;
use crate::state::{PrivacyPool, PendingWithdraw, CommitmentPDA, NullifierPDA};
use crate::errors::ErrorCode;

/// Claim withdrawal via relayer (gasless for recipient)
/// The relayer pays gas, recipient just signs a message off-chain
#[derive(Accounts)]
pub struct ClaimWithdrawRelayed<'info> {
    /// Relayer pays gas (any wallet can be relayer)
    #[account(mut)]
    pub relayer: Signer<'info>,

    /// CHECK: The recipient (stealth address) - NOT a signer
    /// Ownership is proven via ed25519 signature in previous instruction
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA
    #[account(
        mut,
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"pending", pending_withdraw.recipient.as_ref()],
        bump = pending_withdraw.bump,
        constraint = pending_withdraw.recipient == recipient.key() @ ErrorCode::Unauthorized
    )]
    pub pending_withdraw: Account<'info, PendingWithdraw>,

    /// CHECK: Instructions sysvar for ed25519 verification
    #[account(address = instructions_sysvar::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Private withdrawal via relayer
#[derive(Accounts)]
#[instruction(nullifier: [u8; 32], secret_hash: [u8; 32], amount: u64)]
pub struct PrivateWithdrawRelayed<'info> {
    /// Relayer pays gas
    #[account(mut)]
    pub relayer: Signer<'info>,

    /// CHECK: The recipient (any address, typically stealth)
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA
    #[account(
        mut,
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,

    /// Commitment PDA
    #[account(
        mut,
        seeds = [b"commitment", commitment_pda.commitment.as_ref()],
        bump = commitment_pda.bump
    )]
    pub commitment_pda: Account<'info, CommitmentPDA>,

    /// Nullifier PDA - created to mark this nullifier as used
    #[account(
        init,
        payer = relayer,
        space = NullifierPDA::SPACE,
        seeds = [b"nullifier", nullifier.as_ref()],
        bump
    )]
    pub nullifier_pda: Account<'info, NullifierPDA>,

    /// CHECK: Instructions sysvar for ed25519 verification
    #[account(address = instructions_sysvar::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
