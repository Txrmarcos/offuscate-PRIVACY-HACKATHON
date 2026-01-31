//! Privacy Pool State
//!
//! Accounts for the privacy pool feature:
//! - PrivacyPool: Global pool storing aggregate stats
//! - PendingWithdraw: Delayed withdrawal request
//! - ChurnVaultState: Internal mixing vault state

use anchor_lang::prelude::*;

/// The global privacy pool that holds aggregated funds
/// PRIVACY: Only stores aggregate stats, no individual deposit tracking
#[account]
pub struct PrivacyPool {
    pub total_deposited: u64,  // 8 bytes - aggregate deposits
    pub total_withdrawn: u64,  // 8 bytes - aggregate withdrawals
    pub deposit_count: u64,    // 8 bytes - number of deposits
    pub withdraw_count: u64,   // 8 bytes - number of withdrawals
    pub churn_count: u64,      // 8 bytes - number of churn operations
    pub bump: u8,              // 1 byte
    pub vault_bump: u8,        // 1 byte
}

impl PrivacyPool {
    pub const SPACE: usize = 8 +  // discriminator
        8 +                        // total_deposited
        8 +                        // total_withdrawn
        8 +                        // deposit_count
        8 +                        // withdraw_count
        8 +                        // churn_count
        1 +                        // bump
        1 +                        // vault_bump
        16;                        // padding
}

/// State for a churn vault (internal mixing vault)
/// PRIVACY: Enables micro-movements that break graph heuristics
#[account]
pub struct ChurnVaultState {
    pub vault_index: u8,       // 1 byte - which churn vault (0, 1, 2)
    pub total_churned: u64,    // 8 bytes - total SOL churned through
    pub churn_count: u64,      // 8 bytes - number of churn operations
    pub bump: u8,              // 1 byte
    pub vault_bump: u8,        // 1 byte
}

impl ChurnVaultState {
    pub const SPACE: usize = 8 +  // discriminator
        1 +                        // vault_index
        8 +                        // total_churned
        8 +                        // churn_count
        1 +                        // bump
        1 +                        // vault_bump
        16;                        // padding
}

/// A pending withdrawal request with time delay
/// PRIVACY: Only stores recipient (stealth address), not sender
#[account]
pub struct PendingWithdraw {
    pub recipient: Pubkey,     // 32 bytes - stealth address
    pub amount: u64,           // 8 bytes - standardized amount
    pub requested_at: i64,     // 8 bytes - when requested
    pub available_at: i64,     // 8 bytes - when can be claimed
    pub claimed: bool,         // 1 byte
    pub bump: u8,              // 1 byte
}

impl PendingWithdraw {
    pub const SPACE: usize = 8 +  // discriminator
        32 +                       // recipient
        8 +                        // amount
        8 +                        // requested_at
        8 +                        // available_at
        1 +                        // claimed
        1 +                        // bump
        16;                        // padding
}
