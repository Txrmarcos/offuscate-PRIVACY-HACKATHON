//! Stealth Address Handlers
//!
//! Business logic for stealth address operations.

use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::instructions::{SetStealthMetaAddress, RegisterStealthPayment};

/// Set stealth meta-address for a campaign
pub fn set_meta_address(
    ctx: Context<SetStealthMetaAddress>,
    stealth_meta_address: String,
) -> Result<()> {
    require!(stealth_meta_address.len() <= 200, ErrorCode::MetaAddressTooLong);

    let campaign = &mut ctx.accounts.campaign;
    campaign.stealth_meta_address = stealth_meta_address.clone();

    msg!("Stealth meta-address set: {}", stealth_meta_address);

    Ok(())
}

/// Register a stealth payment
pub fn register_payment(
    ctx: Context<RegisterStealthPayment>,
    stealth_address: Pubkey,
    ephemeral_pub_key: String,
    amount: u64,
) -> Result<()> {
    require!(ephemeral_pub_key.len() <= 64, ErrorCode::EphemeralKeyTooLong);

    let registry = &mut ctx.accounts.registry;
    registry.campaign = ctx.accounts.campaign.key();
    registry.stealth_address = stealth_address;
    registry.ephemeral_pub_key = ephemeral_pub_key.clone();
    registry.amount = amount;
    registry.timestamp = Clock::get()?.unix_timestamp;
    registry.bump = ctx.bumps.registry;

    let campaign = &mut ctx.accounts.campaign;
    campaign.stealth_donations = campaign.stealth_donations.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;
    campaign.stealth_total = campaign.stealth_total.checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Stealth payment registered: {} lamports to {}", amount, stealth_address);

    Ok(())
}
