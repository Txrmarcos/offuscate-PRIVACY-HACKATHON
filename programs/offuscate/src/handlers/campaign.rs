//! Campaign Handlers
//!
//! Business logic for campaign operations.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::errors::ErrorCode;
use crate::state::CampaignStatus;
use crate::instructions::{CreateCampaign, Donate, Withdraw, CloseCampaign};

/// Create a new campaign
pub fn create(
    ctx: Context<CreateCampaign>,
    campaign_id: String,
    title: String,
    description: String,
    goal: u64,
    deadline: i64,
) -> Result<()> {
    require!(campaign_id.len() <= 32, ErrorCode::CampaignIdTooLong);
    require!(title.len() <= 64, ErrorCode::TitleTooLong);
    require!(description.len() <= 256, ErrorCode::DescriptionTooLong);
    require!(goal > 0, ErrorCode::InvalidGoal);
    require!(deadline > Clock::get()?.unix_timestamp, ErrorCode::InvalidDeadline);

    let campaign = &mut ctx.accounts.campaign;
    campaign.owner = ctx.accounts.owner.key();
    campaign.campaign_id = campaign_id;
    campaign.title = title;
    campaign.description = description;
    campaign.goal = goal;
    campaign.total_raised = 0;
    campaign.donor_count = 0;
    campaign.deadline = deadline;
    campaign.status = CampaignStatus::Active;
    campaign.created_at = Clock::get()?.unix_timestamp;
    campaign.vault_bump = ctx.bumps.vault;
    campaign.campaign_bump = ctx.bumps.campaign;
    campaign.stealth_meta_address = String::new();
    campaign.stealth_donations = 0;
    campaign.stealth_total = 0;

    msg!("Campaign created: {}", campaign.title);
    msg!("Vault PDA: {}", ctx.accounts.vault.key());

    Ok(())
}

/// Donate to a campaign
pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let campaign = &mut ctx.accounts.campaign;
    require!(campaign.status == CampaignStatus::Active, ErrorCode::CampaignNotActive);
    require!(Clock::get()?.unix_timestamp < campaign.deadline, ErrorCode::CampaignEnded);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.donor.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    campaign.total_raised = campaign.total_raised.checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;
    campaign.donor_count = campaign.donor_count.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Donation received: {} lamports", amount);
    msg!("Total raised: {} lamports", campaign.total_raised);

    if campaign.total_raised >= campaign.goal {
        msg!("Campaign goal reached!");
    }

    Ok(())
}

/// Withdraw funds from campaign vault
pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let campaign = &ctx.accounts.campaign;

    require!(amount > 0, ErrorCode::InvalidAmount);

    let vault_balance = ctx.accounts.vault.lamports();
    require!(amount <= vault_balance, ErrorCode::InsufficientFunds);

    let campaign_id = campaign.campaign_id.as_bytes();
    let bump = campaign.vault_bump;
    let signer_seeds: &[&[&[u8]]] = &[&[b"vault", campaign_id, &[bump]]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.owner.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    msg!("Withdrawn: {} lamports to owner", amount);

    Ok(())
}

/// Close a campaign
pub fn close(ctx: Context<CloseCampaign>) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;

    require!(
        ctx.accounts.owner.key() == campaign.owner,
        ErrorCode::Unauthorized
    );
    require!(
        campaign.status == CampaignStatus::Active,
        ErrorCode::CampaignNotActive
    );

    campaign.status = CampaignStatus::Closed;

    msg!("Campaign closed");

    Ok(())
}
