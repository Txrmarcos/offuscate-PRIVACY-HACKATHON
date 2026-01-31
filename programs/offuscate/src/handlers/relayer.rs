//! Relayer Handlers
//!
//! Business logic for relayer-assisted gasless operations.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked;
use anchor_lang::solana_program::hash::hash;
use crate::constants::ALLOWED_AMOUNTS;
use crate::errors::ErrorCode;
use crate::instructions::{ClaimWithdrawRelayed, PrivateWithdrawRelayed};

/// Claim a pending withdrawal via relayer (gasless)
pub fn claim_withdraw_relayed(ctx: Context<ClaimWithdrawRelayed>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let pending_recipient = ctx.accounts.pending_withdraw.recipient;
    let pending_claimed = ctx.accounts.pending_withdraw.claimed;
    let pending_available_at = ctx.accounts.pending_withdraw.available_at;
    let pending_amount = ctx.accounts.pending_withdraw.amount;

    require!(!pending_claimed, ErrorCode::AlreadyClaimed);
    require!(now >= pending_available_at, ErrorCode::WithdrawNotReady);

    require!(
        ctx.accounts.recipient.key() == pending_recipient,
        ErrorCode::SignerMismatch
    );

    let ix_sysvar = &ctx.accounts.instructions_sysvar;
    let ed25519_ix = load_instruction_at_checked(0, ix_sysvar)?;

    require!(
        ed25519_ix.program_id == ed25519_program::ID,
        ErrorCode::InvalidSignatureInstruction
    );

    let amount = pending_amount;
    let vault_bump = ctx.accounts.pool.vault_bump;
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

    ctx.accounts.pending_withdraw.claimed = true;

    let pool = &mut ctx.accounts.pool;
    pool.total_withdrawn = pool.total_withdrawn.checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;
    pool.withdraw_count = pool.withdraw_count.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    msg!("RELAYED withdrawal claimed: {} lamports to {}", amount, ctx.accounts.recipient.key());
    msg!("Relayer: {} (paid gas)", ctx.accounts.relayer.key());

    Ok(())
}

/// Private withdraw via relayer (gasless)
pub fn private_withdraw_relayed(
    ctx: Context<PrivateWithdrawRelayed>,
    nullifier: [u8; 32],
    secret_hash: [u8; 32],
    amount: u64,
) -> Result<()> {
    require!(
        ALLOWED_AMOUNTS.contains(&amount),
        ErrorCode::InvalidWithdrawAmount
    );

    let ix_sysvar = &ctx.accounts.instructions_sysvar;
    let ed25519_ix = load_instruction_at_checked(0, ix_sysvar)?;
    require!(
        ed25519_ix.program_id == ed25519_program::ID,
        ErrorCode::InvalidSignatureInstruction
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

    msg!("RELAYED private withdrawal: {} lamports", amount);
    msg!("Relayer: {}", ctx.accounts.relayer.key());

    Ok(())
}
