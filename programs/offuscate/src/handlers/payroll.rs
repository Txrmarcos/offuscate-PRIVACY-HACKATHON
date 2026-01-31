//! Payroll Handlers
//!
//! Business logic for streaming payroll operations.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::errors::ErrorCode;
use crate::state::{BatchStatus, EmployeeStatus};
use crate::instructions::{
    InitMasterVault, CreateBatch, AddEmployee, FundBatch,
    ClaimSalary, UpdateSalaryRate, SetEmployeeStatus,
};

/// Initialize the master vault
pub fn init_master_vault(ctx: Context<InitMasterVault>) -> Result<()> {
    let vault = &mut ctx.accounts.master_vault;
    vault.authority = ctx.accounts.authority.key();
    vault.batch_count = 0;
    vault.total_employees = 0;
    vault.total_deposited = 0;
    vault.total_paid = 0;
    vault.bump = ctx.bumps.master_vault;

    msg!("Master vault initialized");
    Ok(())
}

/// Create a new payroll batch
pub fn create_batch(ctx: Context<CreateBatch>, title: String) -> Result<()> {
    require!(title.len() <= 64, ErrorCode::TitleTooLong);

    let master = &mut ctx.accounts.master_vault;
    let batch = &mut ctx.accounts.batch;

    batch.master_vault = master.key();
    batch.owner = ctx.accounts.owner.key();
    batch.index = master.batch_count;
    batch.title = title;
    batch.employee_count = 0;
    batch.total_budget = 0;
    batch.total_paid = 0;
    batch.created_at = Clock::get()?.unix_timestamp;
    batch.status = BatchStatus::Active;
    batch.vault_bump = ctx.bumps.batch_vault;
    batch.batch_bump = ctx.bumps.batch;

    master.batch_count = master.batch_count.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Batch created with index: {}", batch.index);
    Ok(())
}

/// Add an employee to a batch
pub fn add_employee(
    ctx: Context<AddEmployee>,
    stealth_address: String,
    salary_rate: u64,
) -> Result<()> {
    require!(stealth_address.len() <= 200, ErrorCode::MetaAddressTooLong);
    require!(salary_rate > 0, ErrorCode::InvalidSalaryRate);

    let batch = &mut ctx.accounts.batch;
    let employee = &mut ctx.accounts.employee;
    let master = &mut ctx.accounts.master_vault;

    let now = Clock::get()?.unix_timestamp;

    employee.batch = batch.key();
    employee.wallet = ctx.accounts.employee_wallet.key();
    employee.index = batch.employee_count;
    employee.stealth_address = stealth_address;
    employee.salary_rate = salary_rate;
    employee.start_time = now;
    employee.last_claimed_at = now;
    employee.total_claimed = 0;
    employee.status = EmployeeStatus::Active;
    employee.bump = ctx.bumps.employee;

    batch.employee_count = batch.employee_count.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    master.total_employees = master.total_employees.checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Employee added with index: {}, rate: {} lamports/sec", employee.index, salary_rate);
    Ok(())
}

/// Fund a batch's vault
pub fn fund_batch(ctx: Context<FundBatch>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.funder.to_account_info(),
                to: ctx.accounts.batch_vault.to_account_info(),
            },
        ),
        amount,
    )?;

    let batch = &mut ctx.accounts.batch;
    let master = &mut ctx.accounts.master_vault;

    batch.total_budget = batch.total_budget.checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;
    master.total_deposited = master.total_deposited.checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Batch funded: {} lamports", amount);
    Ok(())
}

/// Employee claims accrued salary
pub fn claim_salary(ctx: Context<ClaimSalary>) -> Result<()> {
    let employee = &mut ctx.accounts.employee;
    let batch = &mut ctx.accounts.batch;

    require!(employee.status == EmployeeStatus::Active, ErrorCode::EmployeeNotActive);

    let now = Clock::get()?.unix_timestamp;
    let elapsed = now.checked_sub(employee.last_claimed_at)
        .ok_or(ErrorCode::Overflow)? as u64;

    let accrued = employee.salary_rate.checked_mul(elapsed)
        .ok_or(ErrorCode::Overflow)?;

    require!(accrued > 0, ErrorCode::NoSalaryToClaim);

    let vault_balance = ctx.accounts.batch_vault.lamports();
    let rent = Rent::get()?.minimum_balance(0);
    let available = vault_balance.saturating_sub(rent);

    let claim_amount = accrued.min(available);
    require!(claim_amount > 0, ErrorCode::InsufficientFunds);

    let batch_key = batch.key();
    let vault_seeds: &[&[u8]] = &[
        b"batch_vault",
        batch_key.as_ref(),
        &[batch.vault_bump],
    ];

    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.batch_vault.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
            &[vault_seeds],
        ),
        claim_amount,
    )?;

    employee.last_claimed_at = now;
    employee.total_claimed = employee.total_claimed.checked_add(claim_amount)
        .ok_or(ErrorCode::Overflow)?;

    batch.total_paid = batch.total_paid.checked_add(claim_amount)
        .ok_or(ErrorCode::Overflow)?;

    let master = &mut ctx.accounts.master_vault;
    master.total_paid = master.total_paid.checked_add(claim_amount)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Salary claimed: {} lamports (accrued over {} seconds)", claim_amount, elapsed);
    Ok(())
}

/// Update employee salary rate
pub fn update_salary_rate(ctx: Context<UpdateSalaryRate>, new_rate: u64) -> Result<()> {
    require!(new_rate > 0, ErrorCode::InvalidSalaryRate);

    let employee = &mut ctx.accounts.employee;
    employee.salary_rate = new_rate;

    msg!("Salary rate updated to: {} lamports/sec", new_rate);
    Ok(())
}

/// Set employee status
pub fn set_employee_status(ctx: Context<SetEmployeeStatus>, new_status: EmployeeStatus) -> Result<()> {
    let employee = &mut ctx.accounts.employee;
    employee.status = new_status;

    msg!("Employee status updated");
    Ok(())
}
