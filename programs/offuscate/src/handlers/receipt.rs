//! Receipt Handlers
//!
//! Business logic for anonymous receipt operations.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use crate::errors::ErrorCode;
use crate::instructions::{CreateReceipt, VerifyReceipt, VerifyReceiptBlind};

/// Create an anonymous receipt
pub fn create(ctx: Context<CreateReceipt>, receipt_secret: [u8; 32]) -> Result<()> {
    let employee = &ctx.accounts.employee;
    let batch = &ctx.accounts.batch;
    let now = Clock::get()?.unix_timestamp;

    let elapsed = now.checked_sub(employee.last_claimed_at)
        .unwrap_or(0) as u64;
    let claimed_amount = employee.salary_rate.saturating_mul(elapsed.max(1));

    let mut preimage = Vec::with_capacity(32 + 32 + 8 + 8 + 32);
    preimage.extend_from_slice(&employee.wallet.to_bytes());
    preimage.extend_from_slice(&batch.key().to_bytes());
    preimage.extend_from_slice(&now.to_le_bytes());
    preimage.extend_from_slice(&claimed_amount.to_le_bytes());
    preimage.extend_from_slice(&receipt_secret);

    let commitment = hash(&preimage).to_bytes();

    let receipt = &mut ctx.accounts.receipt;
    receipt.employee = employee.wallet;
    receipt.batch = batch.key();
    receipt.employer = batch.owner;
    receipt.commitment = commitment;
    receipt.timestamp = now;
    receipt.receipt_index = employee.total_claimed;
    receipt.bump = ctx.bumps.receipt;

    msg!("Anonymous receipt created");
    msg!("Receipt can prove payment without revealing amount");

    Ok(())
}

/// Verify an anonymous receipt
pub fn verify(
    ctx: Context<VerifyReceipt>,
    employee_wallet: Pubkey,
    batch_key: Pubkey,
    timestamp: i64,
    amount: u64,
    secret: [u8; 32],
) -> Result<()> {
    let receipt = &ctx.accounts.receipt;

    let mut preimage = Vec::with_capacity(32 + 32 + 8 + 8 + 32);
    preimage.extend_from_slice(&employee_wallet.to_bytes());
    preimage.extend_from_slice(&batch_key.to_bytes());
    preimage.extend_from_slice(&timestamp.to_le_bytes());
    preimage.extend_from_slice(&amount.to_le_bytes());
    preimage.extend_from_slice(&secret);

    let computed_commitment = hash(&preimage).to_bytes();

    require!(
        computed_commitment == receipt.commitment,
        ErrorCode::InvalidReceiptProof
    );

    require!(
        receipt.employee == employee_wallet,
        ErrorCode::ReceiptEmployeeMismatch
    );
    require!(
        receipt.batch == batch_key,
        ErrorCode::ReceiptBatchMismatch
    );
    require!(
        receipt.timestamp == timestamp,
        ErrorCode::ReceiptTimestampMismatch
    );

    msg!("Receipt verified successfully!");
    msg!("Proof: Employee {} received payment from batch {} on {}",
        employee_wallet, batch_key, timestamp);

    Ok(())
}

/// Blind receipt verification
pub fn verify_blind(
    ctx: Context<VerifyReceiptBlind>,
    employee_wallet: Pubkey,
    _timestamp_range_start: i64,
    _timestamp_range_end: i64,
) -> Result<()> {
    let receipt = &ctx.accounts.receipt;

    require!(
        receipt.employee == employee_wallet,
        ErrorCode::ReceiptEmployeeMismatch
    );

    msg!("Blind receipt verification successful");
    msg!("Confirmed: {} has payment receipt from employer {}",
        employee_wallet, receipt.employer);

    Ok(())
}
