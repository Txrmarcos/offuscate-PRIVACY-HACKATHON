//! Privacy Pool Account Contexts
//!
//! Accounts for privacy pool operations:
//! - InitPrivacyPool, PoolDeposit, RequestWithdraw, ClaimWithdraw, etc.

use anchor_lang::prelude::*;
use crate::state::{PrivacyPool, PendingWithdraw, ChurnVaultState};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct InitPrivacyPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = PrivacyPool::SPACE,
        seeds = [b"privacy_pool"],
        bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA - just holds SOL, no data
    #[account(
        mut,
        seeds = [b"pool_vault"],
        bump
    )]
    pub pool_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PoolDeposit<'info> {
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

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestWithdraw<'info> {
    /// Payer for account rent (the connected wallet)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The recipient (stealth address keypair - signs to prove ownership)
    pub recipient: Signer<'info>,

    #[account(
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA (for balance check)
    #[account(
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = PendingWithdraw::SPACE,
        seeds = [b"pending", recipient.key().as_ref()],
        bump
    )]
    pub pending_withdraw: Account<'info, PendingWithdraw>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimWithdraw<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

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
        seeds = [b"pending", recipient.key().as_ref()],
        bump = pending_withdraw.bump,
        constraint = pending_withdraw.recipient == recipient.key() @ ErrorCode::Unauthorized
    )]
    pub pending_withdraw: Account<'info, PendingWithdraw>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetPoolStats<'info> {
    #[account(
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA
    #[account(
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct BatchClaimWithdraw<'info> {
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

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(vault_index: u8)]
pub struct InitChurnVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    #[account(
        init,
        payer = authority,
        space = ChurnVaultState::SPACE,
        seeds = [b"churn_state", vault_index.to_le_bytes().as_ref()],
        bump
    )]
    pub churn_state: Account<'info, ChurnVaultState>,

    /// CHECK: Churn vault PDA - just holds SOL
    #[account(
        mut,
        seeds = [b"churn_vault", vault_index.to_le_bytes().as_ref()],
        bump
    )]
    pub churn_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct PoolChurn<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

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
        seeds = [b"churn_state", churn_state.vault_index.to_le_bytes().as_ref()],
        bump = churn_state.bump
    )]
    pub churn_state: Account<'info, ChurnVaultState>,

    /// CHECK: Churn vault PDA
    #[account(
        mut,
        seeds = [b"churn_vault", churn_state.vault_index.to_le_bytes().as_ref()],
        bump = churn_state.vault_bump
    )]
    pub churn_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct PoolUnchurn<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

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
        seeds = [b"churn_state", churn_state.vault_index.to_le_bytes().as_ref()],
        bump = churn_state.bump
    )]
    pub churn_state: Account<'info, ChurnVaultState>,

    /// CHECK: Churn vault PDA
    #[account(
        mut,
        seeds = [b"churn_vault", churn_state.vault_index.to_le_bytes().as_ref()],
        bump = churn_state.vault_bump
    )]
    pub churn_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
