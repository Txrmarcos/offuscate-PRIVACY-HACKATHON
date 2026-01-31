//! Campaign Account Contexts
//!
//! Campaign CRUD and stealth payment operations

use anchor_lang::prelude::*;
use crate::state::Campaign;
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(campaign_id: String)]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = Campaign::SPACE,
        seeds = [b"campaign", campaign_id.as_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: Vault PDA - just holds SOL, no data
    #[account(
        mut,
        seeds = [b"vault", campaign_id.as_bytes()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [b"vault", campaign.campaign_id.as_bytes()],
        bump = campaign.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [b"vault", campaign.campaign_id.as_bytes()],
        bump = campaign.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseCampaign<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub campaign: Account<'info, Campaign>,

    pub system_program: Program<'info, System>,
}
