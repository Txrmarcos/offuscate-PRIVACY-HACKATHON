//! Commitment-based Privacy Account Contexts
//!
//! ZK-like privacy operations using commitment schemes:
//! - PrivateDeposit: Deposit with commitment hash
//! - PrivateWithdraw: Withdraw by revealing secret (proves knowledge)

use anchor_lang::prelude::*;
use crate::state::{PrivacyPool, CommitmentPDA, NullifierPDA};

/// Private deposit with commitment scheme
///
/// The depositor creates: commitment = hash(secret || nullifier || amount)
/// Only the depositor knows secret and nullifier.
/// To withdraw: reveal (nullifier, secret_hash, amount) such that
/// hash(secret_hash || nullifier || amount) matches stored commitment.
#[derive(Accounts)]
#[instruction(commitment: [u8; 32])]
pub struct PrivateDeposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

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

    /// Commitment PDA - stores the commitment hash
    /// Derived from the commitment bytes so only one deposit per commitment
    #[account(
        init,
        payer = depositor,
        space = CommitmentPDA::SPACE,
        seeds = [b"commitment", commitment.as_ref()],
        bump
    )]
    pub commitment_pda: Account<'info, CommitmentPDA>,

    pub system_program: Program<'info, System>,
}

/// Private withdrawal by revealing secret
///
/// To withdraw, the user must provide:
/// - nullifier: unique identifier, used once
/// - secret_hash: hash of secret
/// - amount: the amount to withdraw
///
/// The instruction verifies: hash(secret_hash || nullifier || amount) == stored_commitment
/// If valid, creates nullifier PDA (prevents reuse) and sends funds.
#[derive(Accounts)]
#[instruction(nullifier: [u8; 32], secret_hash: [u8; 32], amount: u64)]
pub struct PrivateWithdraw<'info> {
    /// Payer for the transaction (can be anyone)
    #[account(mut)]
    pub payer: Signer<'info>,

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

    /// Commitment PDA - verify it exists and hasn't been spent
    /// The commitment is recomputed from secret_hash || nullifier || amount
    #[account(
        mut,
        seeds = [b"commitment", commitment_pda.commitment.as_ref()],
        bump = commitment_pda.bump
    )]
    pub commitment_pda: Account<'info, CommitmentPDA>,

    /// Nullifier PDA - created to mark this nullifier as used
    /// If this account already exists, the withdrawal will fail (double-spend prevention)
    #[account(
        init,
        payer = payer,
        space = NullifierPDA::SPACE,
        seeds = [b"nullifier", nullifier.as_ref()],
        bump
    )]
    pub nullifier_pda: Account<'info, NullifierPDA>,

    pub system_program: Program<'info, System>,
}
