//! Commitment-based Privacy Handlers
//!
//! Business logic for commitment-based privacy operations (ZK-like).

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::hash::hash;
use crate::constants::ALLOWED_AMOUNTS;
use crate::errors::ErrorCode;
use crate::instructions::{PrivateDeposit, PrivateWithdraw};

/// Private deposit with commitment
pub fn deposit(
    ctx: Context<PrivateDeposit>,
    commitment: [u8; 32],
    amount: u64,
) -> Result<()> {
    require!(
        ALLOWED_AMOUNTS.contains(&amount),
        ErrorCode::InvalidWithdrawAmount
    );

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.depositor.to_account_info(),
                to: ctx.accounts.pool_vault.to_account_info(),
            },
        ),
        amount,
    )?;

    let commitment_pda = &mut ctx.accounts.commitment_pda;
    commitment_pda.commitment = commitment;
    commitment_pda.amount = amount;
    commitment_pda.timestamp = Clock::get()?.unix_timestamp;
    commitment_pda.spent = false;
    commitment_pda.bump = ctx.bumps.commitment_pda;

    let pool = &mut ctx.accounts.pool;
    pool.total_deposited = pool.total_deposited.checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;
    pool.deposit_count = pool.deposit_count.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Private deposit: {} lamports", amount);

    Ok(())
}

/// Private withdraw with nullifier
pub fn withdraw(
    ctx: Context<PrivateWithdraw>,
    nullifier: [u8; 32],
    secret_hash: [u8; 32],
    amount: u64,
) -> Result<()> {
    require!(
        ALLOWED_AMOUNTS.contains(&amount),
        ErrorCode::InvalidWithdrawAmount
    );

    let mut preimage = Vec::with_capacity(72);
    preimage.extend_from_slice(&secret_hash);
    preimage.extend_from_slice(&nullifier);
    preimage.extend_from_slice(&amount.to_le_bytes());

    let computed_commitment = hash(&preimage).to_bytes();

    let commitment_pda = &mut ctx.accounts.commitment_pda;
    require!(
        computed_commitment == commitment_pda.commitment,
        ErrorCode::InvalidCommitmentProof
    );
    require!(!commitment_pda.spent, ErrorCode::NullifierAlreadyUsed);
    require!(commitment_pda.amount == amount, ErrorCode::InvalidAmount);

    commitment_pda.spent = true;

    let nullifier_pda = &mut ctx.accounts.nullifier_pda;
    nullifier_pda.nullifier = nullifier;
    nullifier_pda.used_at = Clock::get()?.unix_timestamp;
    nullifier_pda.bump = ctx.bumps.nullifier_pda;

    let pool = &ctx.accounts.pool;
    let vault_bump = pool.vault_bump;
    let signer_seeds: &[&[&[u8]]] = &[&[b"pool_vault", &[vault_bump]]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.pool_vault.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    let pool = &mut ctx.accounts.pool;
    pool.total_withdrawn = pool.total_withdrawn.checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;
    pool.withdraw_count = pool.withdraw_count.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Private withdrawal: {} lamports", amount);

    Ok(())
}
