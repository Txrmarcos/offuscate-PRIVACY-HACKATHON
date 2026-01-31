//! Stealth Address Account Contexts
//!
//! Stealth payment registration and meta-address operations

use anchor_lang::prelude::*;
use crate::state::{Campaign, StealthRegistry};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct SetStealthMetaAddress<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub campaign: Account<'info, Campaign>,
}

#[derive(Accounts)]
#[instruction(stealth_address: Pubkey)]
pub struct RegisterStealthPayment<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        init,
        payer = donor,
        space = StealthRegistry::SPACE,
        seeds = [b"stealth", campaign.key().as_ref(), stealth_address.as_ref()],
        bump
    )]
    pub registry: Account<'info, StealthRegistry>,

    pub system_program: Program<'info, System>,
}
