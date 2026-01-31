//! Payroll Account Contexts
//!
//! Streaming payroll operations

use anchor_lang::prelude::*;
use crate::state::{MasterVault, PayrollBatch, Employee, BatchStatus};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct InitMasterVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = MasterVault::SPACE,
        seeds = [b"master_vault"],
        bump
    )]
    pub master_vault: Account<'info, MasterVault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct CreateBatch<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"master_vault"],
        bump = master_vault.bump
    )]
    pub master_vault: Account<'info, MasterVault>,

    #[account(
        init,
        payer = owner,
        space = PayrollBatch::SPACE,
        seeds = [b"batch", master_vault.key().as_ref(), &master_vault.batch_count.to_le_bytes()],
        bump
    )]
    pub batch: Account<'info, PayrollBatch>,

    /// CHECK: Batch vault PDA
    #[account(
        mut,
        seeds = [b"batch_vault", batch.key().as_ref()],
        bump
    )]
    pub batch_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(stealth_address: String, salary_rate: u64)]
pub struct AddEmployee<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub master_vault: Account<'info, MasterVault>,

    #[account(
        mut,
        constraint = batch.owner == owner.key() @ ErrorCode::Unauthorized,
        constraint = batch.status == BatchStatus::Active @ ErrorCode::CampaignNotActive
    )]
    pub batch: Account<'info, PayrollBatch>,

    /// CHECK: Employee wallet to be added
    pub employee_wallet: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = Employee::SPACE,
        seeds = [b"employee", batch.key().as_ref(), &batch.employee_count.to_le_bytes()],
        bump
    )]
    pub employee: Account<'info, Employee>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundBatch<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,

    #[account(mut)]
    pub master_vault: Account<'info, MasterVault>,

    #[account(mut)]
    pub batch: Account<'info, PayrollBatch>,

    /// CHECK: Batch vault PDA
    #[account(
        mut,
        seeds = [b"batch_vault", batch.key().as_ref()],
        bump = batch.vault_bump
    )]
    pub batch_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimSalary<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    #[account(mut)]
    pub master_vault: Account<'info, MasterVault>,

    #[account(mut)]
    pub batch: Account<'info, PayrollBatch>,

    /// CHECK: Batch vault PDA
    #[account(
        mut,
        seeds = [b"batch_vault", batch.key().as_ref()],
        bump = batch.vault_bump
    )]
    pub batch_vault: SystemAccount<'info>,

    #[account(
        mut,
        constraint = employee.wallet == recipient.key() @ ErrorCode::Unauthorized,
        constraint = employee.batch == batch.key() @ ErrorCode::Unauthorized
    )]
    pub employee: Account<'info, Employee>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateSalaryRate<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        constraint = batch.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub batch: Account<'info, PayrollBatch>,

    #[account(
        mut,
        constraint = employee.batch == batch.key() @ ErrorCode::Unauthorized
    )]
    pub employee: Account<'info, Employee>,
}

#[derive(Accounts)]
pub struct SetEmployeeStatus<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        constraint = batch.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub batch: Account<'info, PayrollBatch>,

    #[account(
        mut,
        constraint = employee.batch == batch.key() @ ErrorCode::Unauthorized
    )]
    pub employee: Account<'info, Employee>,
}
