//! Invite System Handlers
//!
//! Business logic for invite operations.

use anchor_lang::prelude::*;
use crate::errors::ErrorCode;
use crate::state::{InviteStatus, EmployeeStatus};
use crate::instructions::{
    CreateInvite, CreateBatchInvite, AcceptInvite, RevokeInvite, AcceptInviteStreaming,
};

/// Create an invite for a campaign
pub fn create(
    ctx: Context<CreateInvite>,
    invite_code: String,
    salary_rate: u64,
) -> Result<()> {
    require!(invite_code.len() <= 16, ErrorCode::InviteCodeTooLong);
    require!(invite_code.len() >= 6, ErrorCode::InviteCodeTooShort);

    let invite = &mut ctx.accounts.invite;
    invite.batch = ctx.accounts.campaign.key();
    invite.invite_code = invite_code;
    invite.creator = ctx.accounts.owner.key();
    invite.recipient = Pubkey::default();
    invite.recipient_stealth_address = String::new();
    invite.salary_rate = salary_rate;
    invite.status = InviteStatus::Pending;
    invite.created_at = Clock::get()?.unix_timestamp;
    invite.accepted_at = 0;
    invite.bump = ctx.bumps.invite;

    msg!("Invite created for batch: {}", ctx.accounts.campaign.campaign_id);
    if salary_rate > 0 {
        msg!("Streaming salary configured: {} lamports/sec", salary_rate);
    }

    Ok(())
}

/// Create an invite for a payroll batch
pub fn create_batch_invite(
    ctx: Context<CreateBatchInvite>,
    invite_code: String,
    salary_rate: u64,
) -> Result<()> {
    require!(invite_code.len() <= 16, ErrorCode::InviteCodeTooLong);
    require!(invite_code.len() >= 6, ErrorCode::InviteCodeTooShort);

    let invite = &mut ctx.accounts.invite;
    invite.batch = ctx.accounts.batch.key();
    invite.invite_code = invite_code;
    invite.creator = ctx.accounts.owner.key();
    invite.recipient = Pubkey::default();
    invite.recipient_stealth_address = String::new();
    invite.salary_rate = salary_rate;
    invite.status = InviteStatus::Pending;
    invite.created_at = Clock::get()?.unix_timestamp;
    invite.accepted_at = 0;
    invite.bump = ctx.bumps.invite;

    msg!("Invite created for payroll batch: {}", ctx.accounts.batch.title);
    if salary_rate > 0 {
        msg!("Streaming salary configured: {} lamports/sec", salary_rate);
    }

    Ok(())
}

/// Accept an invite
pub fn accept(
    ctx: Context<AcceptInvite>,
    stealth_meta_address: String,
) -> Result<()> {
    require!(stealth_meta_address.len() <= 200, ErrorCode::MetaAddressTooLong);
    require!(stealth_meta_address.len() > 0, ErrorCode::StealthAddressRequired);

    let invite = &mut ctx.accounts.invite;
    require!(invite.status == InviteStatus::Pending, ErrorCode::InviteNotPending);

    invite.recipient = ctx.accounts.recipient.key();
    invite.recipient_stealth_address = stealth_meta_address.clone();
    invite.status = InviteStatus::Accepted;
    invite.accepted_at = Clock::get()?.unix_timestamp;

    msg!("Invite accepted by: {}", ctx.accounts.recipient.key());
    msg!("Stealth address registered: {}", stealth_meta_address);

    Ok(())
}

/// Revoke an invite
pub fn revoke(ctx: Context<RevokeInvite>) -> Result<()> {
    let invite = &mut ctx.accounts.invite;
    require!(invite.status == InviteStatus::Pending, ErrorCode::InviteNotPending);

    invite.status = InviteStatus::Revoked;

    msg!("Invite revoked");

    Ok(())
}

/// Accept invite and add to streaming payroll
pub fn accept_streaming(
    ctx: Context<AcceptInviteStreaming>,
    stealth_meta_address: String,
) -> Result<()> {
    require!(stealth_meta_address.len() <= 200, ErrorCode::MetaAddressTooLong);
    require!(stealth_meta_address.len() > 0, ErrorCode::StealthAddressRequired);

    let invite = &mut ctx.accounts.invite;
    require!(invite.status == InviteStatus::Pending, ErrorCode::InviteNotPending);
    require!(invite.salary_rate > 0, ErrorCode::InviteNoSalaryConfigured);

    let now = Clock::get()?.unix_timestamp;

    invite.recipient = ctx.accounts.payer.key();
    invite.recipient_stealth_address = stealth_meta_address.clone();
    invite.status = InviteStatus::Accepted;
    invite.accepted_at = now;

    let employee = &mut ctx.accounts.employee;
    let batch = &mut ctx.accounts.batch;
    let master = &mut ctx.accounts.master_vault;

    employee.batch = batch.key();
    employee.wallet = ctx.accounts.employee_stealth_pubkey.key();
    employee.index = batch.employee_count;
    employee.stealth_address = stealth_meta_address;
    employee.salary_rate = invite.salary_rate;
    employee.start_time = now;
    employee.last_claimed_at = now;
    employee.total_claimed = 0;
    employee.status = EmployeeStatus::Active;
    employee.bump = ctx.bumps.employee;

    batch.employee_count = batch.employee_count.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;
    master.total_employees = master.total_employees.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Invite accepted with streaming!");
    msg!("Employee created with stealth pubkey: {}", ctx.accounts.employee_stealth_pubkey.key());
    msg!("Salary rate: {} lamports/sec", invite.salary_rate);
    msg!("PRIVACY: Main wallet NOT linked to employee account");

    Ok(())
}
