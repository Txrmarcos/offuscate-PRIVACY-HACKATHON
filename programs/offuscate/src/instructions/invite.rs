//! Invite System Account Contexts
//!
//! Employee onboarding via invite codes

use anchor_lang::prelude::*;
use crate::state::{Campaign, Invite, PayrollBatch, Employee, MasterVault};
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(invite_code: String)]
pub struct CreateInvite<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        init,
        payer = owner,
        space = Invite::SPACE,
        seeds = [b"invite", invite_code.as_bytes()],
        bump
    )]
    pub invite: Account<'info, Invite>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(invite_code: String)]
pub struct CreateBatchInvite<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"batch", batch.master_vault.as_ref(), &batch.index.to_le_bytes()],
        bump = batch.batch_bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub batch: Account<'info, PayrollBatch>,

    #[account(
        init,
        payer = owner,
        space = Invite::SPACE,
        seeds = [b"invite", invite_code.as_bytes()],
        bump
    )]
    pub invite: Account<'info, Invite>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptInvite<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    #[account(
        mut,
        seeds = [b"invite", invite.invite_code.as_bytes()],
        bump = invite.bump
    )]
    pub invite: Account<'info, Invite>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeInvite<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"invite", invite.invite_code.as_bytes()],
        bump = invite.bump,
        constraint = invite.creator == owner.key() @ ErrorCode::Unauthorized
    )]
    pub invite: Account<'info, Invite>,

    pub system_program: Program<'info, System>,
}

/// Accept invite and automatically create Employee with streaming payroll
#[derive(Accounts)]
#[instruction(stealth_meta_address: String)]
pub struct AcceptInviteStreaming<'info> {
    /// Payer for the transaction (can be main wallet or relayer)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The stealth public key that will own the Employee account
    /// CHECK: Any pubkey can be used as stealth - employee controls private key locally
    pub employee_stealth_pubkey: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"invite", invite.invite_code.as_bytes()],
        bump = invite.bump
    )]
    pub invite: Account<'info, Invite>,

    #[account(
        mut,
        seeds = [b"master_vault"],
        bump = master_vault.bump
    )]
    pub master_vault: Account<'info, MasterVault>,

    /// The batch this invite belongs to
    #[account(
        mut,
        constraint = batch.owner == invite.creator @ ErrorCode::Unauthorized
    )]
    pub batch: Account<'info, PayrollBatch>,

    /// The new employee account (created with stealth pubkey)
    #[account(
        init,
        payer = payer,
        space = Employee::SPACE,
        seeds = [b"employee", batch.key().as_ref(), &batch.employee_count.to_le_bytes()],
        bump
    )]
    pub employee: Account<'info, Employee>,

    pub system_program: Program<'info, System>,
}
