//! Payroll State
//!
//! Index-based payroll for enhanced privacy:
//! - MasterVault: Global singleton tracking all indices
//! - PayrollBatch: Batch of employees
//! - Employee: Individual employee with streaming salary
//! - BatchStatus/EmployeeStatus: Status enums

use anchor_lang::prelude::*;

/// Batch status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BatchStatus {
    Active,
    Paused,
    Closed,
}

/// Employee status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum EmployeeStatus {
    Active,
    Paused,
    Terminated,
}

/// Master Vault - Global singleton that tracks all indices
/// This hides organizational relationships by using sequential indices
#[account]
pub struct MasterVault {
    pub authority: Pubkey,          // 32 bytes - who can modify
    pub batch_count: u32,           // 4 bytes - total batches created
    pub total_employees: u32,       // 4 bytes - total employees across all batches
    pub total_deposited: u64,       // 8 bytes - total deposited
    pub total_paid: u64,            // 8 bytes - total paid out
    pub bump: u8,                   // 1 byte
}

impl MasterVault {
    pub const SPACE: usize = 8 +    // discriminator
        32 +                         // authority
        4 +                          // batch_count
        4 +                          // total_employees
        8 +                          // total_deposited
        8 +                          // total_paid
        1 +                          // bump
        32;                          // padding
}

/// PayrollBatch - Index-based PDA (no pubkey or name in seeds)
/// Seeds: ["batch", master_vault, index]
#[account]
pub struct PayrollBatch {
    pub master_vault: Pubkey,       // 32 bytes - reference to master vault
    pub owner: Pubkey,              // 32 bytes - company wallet
    pub index: u32,                 // 4 bytes - sequential index
    pub title: String,              // 4 + 64 = 68 bytes - batch name
    pub employee_count: u32,        // 4 bytes - number of employees
    pub total_budget: u64,          // 8 bytes - total budget allocated
    pub total_paid: u64,            // 8 bytes - total paid out
    pub created_at: i64,            // 8 bytes
    pub status: BatchStatus,        // 1 byte
    pub vault_bump: u8,             // 1 byte
    pub batch_bump: u8,             // 1 byte
}

impl PayrollBatch {
    pub const SPACE: usize = 8 +    // discriminator
        32 +                         // master_vault
        32 +                         // owner
        4 +                          // index
        (4 + 64) +                   // title
        4 +                          // employee_count
        8 +                          // total_budget
        8 +                          // total_paid
        8 +                          // created_at
        1 +                          // status
        1 +                          // vault_bump
        1 +                          // batch_bump
        32;                          // padding
}

/// Employee - Index-based PDA with streaming salary
/// Seeds: ["employee", batch, index]
#[account]
pub struct Employee {
    pub batch: Pubkey,              // 32 bytes - which batch
    pub wallet: Pubkey,             // 32 bytes - employee wallet
    pub index: u32,                 // 4 bytes - sequential index within batch
    pub stealth_address: String,    // 4 + 200 = 204 bytes - stealth meta address
    pub salary_rate: u64,           // 8 bytes - lamports per second
    pub start_time: i64,            // 8 bytes - when salary started
    pub last_claimed_at: i64,       // 8 bytes - last claim timestamp
    pub total_claimed: u64,         // 8 bytes - total claimed so far
    pub status: EmployeeStatus,     // 1 byte
    pub bump: u8,                   // 1 byte
}

impl Employee {
    pub const SPACE: usize = 8 +    // discriminator
        32 +                         // batch
        32 +                         // wallet
        4 +                          // index
        (4 + 200) +                  // stealth_address
        8 +                          // salary_rate
        8 +                          // start_time
        8 +                          // last_claimed_at
        8 +                          // total_claimed
        1 +                          // status
        1 +                          // bump
        32;                          // padding
}
