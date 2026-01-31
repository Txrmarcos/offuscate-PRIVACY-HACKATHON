//! Privacy Pool Handlers
//!
//! Business logic for privacy pool operations.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::{ALLOWED_AMOUNTS, MIN_DELAY_SECONDS, MAX_DELAY_SECONDS};
use crate::errors::ErrorCode;
use crate::instructions::{
    InitPrivacyPool, PoolDeposit, RequestWithdraw, ClaimWithdraw,
    GetPoolStats, BatchClaimWithdraw, InitChurnVault, PoolChurn, PoolUnchurn,
};

/// Initialize the global privacy pool
pub fn init(ctx: Context<InitPrivacyPool>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    pool.total_deposited = 0;
    pool.total_withdrawn = 0;
    pool.deposit_count = 0;
    pool.withdraw_count = 0;
    pool.churn_count = 0;
    pool.bump = ctx.bumps.pool;
    pool.vault_bump = ctx.bumps.pool_vault;

    msg!("Privacy Pool initialized");
    msg!("Pool vault: {}", ctx.accounts.pool_vault.key());

    Ok(())
}

/// Deposit SOL into the privacy pool
pub fn deposit(ctx: Context<PoolDeposit>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

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

    let pool = &mut ctx.accounts.pool;
    pool.total_deposited = pool.total_deposited.checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;
    pool.deposit_count = pool.deposit_count.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Pool deposit: {} lamports", amount);
    msg!("Pool total: {} lamports", pool.total_deposited);

    Ok(())
}

/// Request a withdrawal from the privacy pool
pub fn request_withdraw(ctx: Context<RequestWithdraw>, amount: u64) -> Result<()> {
    require!(
        ALLOWED_AMOUNTS.contains(&amount),
        ErrorCode::InvalidWithdrawAmount
    );

    let pool_balance = ctx.accounts.pool_vault.lamports();
    require!(amount <= pool_balance, ErrorCode::InsufficientPoolFunds);

    let pending = &mut ctx.accounts.pending_withdraw;
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    let recipient_bytes = ctx.accounts.recipient.key().to_bytes();
    let entropy = clock.slot
        .wrapping_add(recipient_bytes[0] as u64)
        .wrapping_add(recipient_bytes[31] as u64)
        .wrapping_mul(0x5851F42D4C957F2D);

    let delay_range = (MAX_DELAY_SECONDS - MIN_DELAY_SECONDS) as u64;
    let variable_delay = MIN_DELAY_SECONDS + ((entropy % delay_range) as i64);

    pending.recipient = ctx.accounts.recipient.key();
    pending.amount = amount;
    pending.requested_at = now;
    pending.available_at = now + variable_delay;
    pending.claimed = false;
    pending.bump = ctx.bumps.pending_withdraw;

    msg!("Withdrawal requested: {} lamports", amount);
    msg!("Available at: {} (variable delay: {}s)", pending.available_at, variable_delay);

    Ok(())
}

/// Claim a pending withdrawal
pub fn claim_withdraw(ctx: Context<ClaimWithdraw>) -> Result<()> {
    let pending = &mut ctx.accounts.pending_withdraw;
    let now = Clock::get()?.unix_timestamp;

    require!(!pending.claimed, ErrorCode::AlreadyClaimed);
    require!(now >= pending.available_at, ErrorCode::WithdrawNotReady);

    let amount = pending.amount;
    let pool = &ctx.accounts.pool;
    let signer_seeds: &[&[&[u8]]] = &[&[b"pool_vault", &[pool.vault_bump]]];

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

    pending.claimed = true;

    let pool = &mut ctx.accounts.pool;
    pool.total_withdrawn = pool.total_withdrawn.checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;
    pool.withdraw_count = pool.withdraw_count.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Withdrawal claimed: {} lamports to {}", amount, ctx.accounts.recipient.key());

    Ok(())
}

/// Get pool stats
pub fn get_stats(ctx: Context<GetPoolStats>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let balance = ctx.accounts.pool_vault.lamports();

    msg!("=== Privacy Pool Stats ===");
    msg!("Current balance: {} lamports", balance);
    msg!("Total deposited: {} lamports", pool.total_deposited);
    msg!("Total withdrawn: {} lamports", pool.total_withdrawn);
    msg!("Deposit count: {}", pool.deposit_count);
    msg!("Withdraw count: {}", pool.withdraw_count);

    Ok(())
}

/// Batch claim withdrawals
pub fn batch_claim<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, BatchClaimWithdraw<'info>>,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let now = Clock::get()?.unix_timestamp;

    let remaining = &ctx.remaining_accounts;
    require!(remaining.len() >= 2, ErrorCode::BatchTooSmall);
    require!(remaining.len() % 2 == 0, ErrorCode::BatchInvalidPairs);
    require!(remaining.len() <= 10, ErrorCode::BatchTooLarge);

    let num_claims = remaining.len() / 2;
    let mut total_claimed: u64 = 0;
    let mut success_count: u64 = 0;

    for i in 0..num_claims {
        let recipient_info = &remaining[i * 2];
        let pending_info = &remaining[i * 2 + 1];

        let mut pending_data = pending_info.try_borrow_mut_data()?;

        if pending_data.len() < 8 + 32 + 8 + 8 + 8 + 1 + 1 {
            msg!("Skipping invalid pending account at index {}", i);
            continue;
        }

        let stored_recipient = Pubkey::try_from(&pending_data[8..40]).unwrap_or_default();
        let amount = u64::from_le_bytes(pending_data[40..48].try_into().unwrap_or_default());
        let available_at = i64::from_le_bytes(pending_data[56..64].try_into().unwrap_or_default());
        let claimed = pending_data[64] != 0;

        if stored_recipient != *recipient_info.key {
            msg!("Recipient mismatch at index {}", i);
            continue;
        }

        if claimed {
            msg!("Already claimed at index {}", i);
            continue;
        }
        if now < available_at {
            msg!("Not ready yet at index {}", i);
            continue;
        }

        let pool_balance = ctx.accounts.pool_vault.lamports();
        if amount > pool_balance {
            msg!("Insufficient funds for index {}", i);
            continue;
        }

        **ctx.accounts.pool_vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **recipient_info.try_borrow_mut_lamports()? += amount;

        pending_data[64] = 1;

        total_claimed = total_claimed.saturating_add(amount);
        success_count += 1;

        msg!("Batch claim {}: {} lamports to {}", i, amount, recipient_info.key);
    }

    if success_count > 0 {
        pool.total_withdrawn = pool.total_withdrawn.saturating_add(total_claimed);
        pool.withdraw_count = pool.withdraw_count.saturating_add(success_count);
    }

    msg!("Batch withdrawal complete: {} claims, {} total lamports", success_count, total_claimed);

    Ok(())
}

/// Initialize a churn vault
pub fn init_churn_vault(ctx: Context<InitChurnVault>, vault_index: u8) -> Result<()> {
    require!(vault_index < 3, ErrorCode::InvalidChurnIndex);

    let churn_state = &mut ctx.accounts.churn_state;
    churn_state.vault_index = vault_index;
    churn_state.total_churned = 0;
    churn_state.churn_count = 0;
    churn_state.bump = ctx.bumps.churn_state;
    churn_state.vault_bump = ctx.bumps.churn_vault;

    msg!("Churn vault {} initialized", vault_index);

    Ok(())
}

/// Move funds from main pool to churn vault
pub fn churn(ctx: Context<PoolChurn>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let pool_balance = ctx.accounts.pool_vault.lamports();
    require!(amount <= pool_balance, ErrorCode::InsufficientPoolFunds);

    let pool = &ctx.accounts.pool;
    let signer_seeds: &[&[&[u8]]] = &[&[b"pool_vault", &[pool.vault_bump]]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.pool_vault.to_account_info(),
                to: ctx.accounts.churn_vault.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    let churn_state = &mut ctx.accounts.churn_state;
    churn_state.total_churned = churn_state.total_churned.saturating_add(amount);
    churn_state.churn_count = churn_state.churn_count.saturating_add(1);

    let pool = &mut ctx.accounts.pool;
    pool.churn_count = pool.churn_count.saturating_add(1);

    msg!("Pool churn: {} lamports to vault {}", amount, churn_state.vault_index);

    Ok(())
}

/// Return funds from churn vault to main pool
pub fn unchurn(ctx: Context<PoolUnchurn>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let churn_balance = ctx.accounts.churn_vault.lamports();
    require!(amount <= churn_balance, ErrorCode::InsufficientChurnFunds);

    let churn_state = &ctx.accounts.churn_state;
    let vault_index_bytes = churn_state.vault_index.to_le_bytes();
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"churn_vault",
        vault_index_bytes.as_ref(),
        &[churn_state.vault_bump]
    ]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.churn_vault.to_account_info(),
                to: ctx.accounts.pool_vault.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    msg!("Pool unchurn: {} lamports from vault {}", amount, churn_state.vault_index);

    Ok(())
}
