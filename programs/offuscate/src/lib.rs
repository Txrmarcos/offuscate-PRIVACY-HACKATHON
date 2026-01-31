use anchor_lang::prelude::*;

// ==============================================
// MODULAR STRUCTURE
// ==============================================
//
// The codebase is organized into modules:
// - constants: Program constants (delay times, allowed amounts)
// - errors: All error codes
// - state: Account state structures (PrivacyPool, Campaign, etc.)
// - instructions: Account contexts for each instruction
// - handlers: Business logic for each instruction

pub mod constants;
pub mod errors;
pub mod state;
pub mod instructions;
pub mod handlers;

// Re-export from modules
pub use constants::*;
pub use errors::ErrorCode;
pub use state::*;
pub use instructions::*;

declare_id!("5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq");

#[program]
pub mod offuscate {
    use super::*;

    // ==============================================
    // PRIVACY POOL
    // ==============================================

    pub fn init_privacy_pool(ctx: Context<InitPrivacyPool>) -> Result<()> {
        handlers::privacy_pool::init(ctx)
    }

    pub fn pool_deposit(ctx: Context<PoolDeposit>, amount: u64) -> Result<()> {
        handlers::privacy_pool::deposit(ctx, amount)
    }

    pub fn request_withdraw(ctx: Context<RequestWithdraw>, amount: u64) -> Result<()> {
        handlers::privacy_pool::request_withdraw(ctx, amount)
    }

    pub fn claim_withdraw(ctx: Context<ClaimWithdraw>) -> Result<()> {
        handlers::privacy_pool::claim_withdraw(ctx)
    }

    pub fn get_pool_stats(ctx: Context<GetPoolStats>) -> Result<()> {
        handlers::privacy_pool::get_stats(ctx)
    }

    pub fn batch_claim_withdraw<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, BatchClaimWithdraw<'info>>,
    ) -> Result<()> {
        handlers::privacy_pool::batch_claim(ctx)
    }

    pub fn init_churn_vault(ctx: Context<InitChurnVault>, vault_index: u8) -> Result<()> {
        handlers::privacy_pool::init_churn_vault(ctx, vault_index)
    }

    pub fn pool_churn(ctx: Context<PoolChurn>, amount: u64) -> Result<()> {
        handlers::privacy_pool::churn(ctx, amount)
    }

    pub fn pool_unchurn(ctx: Context<PoolUnchurn>, amount: u64) -> Result<()> {
        handlers::privacy_pool::unchurn(ctx, amount)
    }

    // ==============================================
    // RELAYER / GASLESS
    // ==============================================

    pub fn claim_withdraw_relayed(ctx: Context<ClaimWithdrawRelayed>) -> Result<()> {
        handlers::relayer::claim_withdraw_relayed(ctx)
    }

    pub fn private_withdraw_relayed(
        ctx: Context<PrivateWithdrawRelayed>,
        nullifier: [u8; 32],
        secret_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        handlers::relayer::private_withdraw_relayed(ctx, nullifier, secret_hash, amount)
    }

    // ==============================================
    // CAMPAIGNS
    // ==============================================

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_id: String,
        title: String,
        description: String,
        goal: u64,
        deadline: i64,
    ) -> Result<()> {
        handlers::campaign::create(ctx, campaign_id, title, description, goal, deadline)
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        handlers::campaign::donate(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        handlers::campaign::withdraw(ctx, amount)
    }

    pub fn close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
        handlers::campaign::close(ctx)
    }

    // ==============================================
    // STEALTH ADDRESSES
    // ==============================================

    pub fn set_stealth_meta_address(
        ctx: Context<SetStealthMetaAddress>,
        stealth_meta_address: String,
    ) -> Result<()> {
        handlers::stealth::set_meta_address(ctx, stealth_meta_address)
    }

    pub fn register_stealth_payment(
        ctx: Context<RegisterStealthPayment>,
        stealth_address: Pubkey,
        ephemeral_pub_key: String,
        amount: u64,
    ) -> Result<()> {
        handlers::stealth::register_payment(ctx, stealth_address, ephemeral_pub_key, amount)
    }

    // ==============================================
    // INVITE SYSTEM
    // ==============================================

    pub fn create_invite(
        ctx: Context<CreateInvite>,
        invite_code: String,
        salary_rate: u64,
    ) -> Result<()> {
        handlers::invite::create(ctx, invite_code, salary_rate)
    }

    pub fn create_batch_invite(
        ctx: Context<CreateBatchInvite>,
        invite_code: String,
        salary_rate: u64,
    ) -> Result<()> {
        handlers::invite::create_batch_invite(ctx, invite_code, salary_rate)
    }

    pub fn accept_invite(ctx: Context<AcceptInvite>, stealth_meta_address: String) -> Result<()> {
        handlers::invite::accept(ctx, stealth_meta_address)
    }

    pub fn revoke_invite(ctx: Context<RevokeInvite>) -> Result<()> {
        handlers::invite::revoke(ctx)
    }

    pub fn accept_invite_streaming(
        ctx: Context<AcceptInviteStreaming>,
        stealth_meta_address: String,
    ) -> Result<()> {
        handlers::invite::accept_streaming(ctx, stealth_meta_address)
    }

    // ==============================================
    // STREAMING PAYROLL
    // ==============================================

    pub fn init_master_vault(ctx: Context<InitMasterVault>) -> Result<()> {
        handlers::payroll::init_master_vault(ctx)
    }

    pub fn create_batch(ctx: Context<CreateBatch>, title: String) -> Result<()> {
        handlers::payroll::create_batch(ctx, title)
    }

    pub fn add_employee(
        ctx: Context<AddEmployee>,
        stealth_address: String,
        salary_rate: u64,
    ) -> Result<()> {
        handlers::payroll::add_employee(ctx, stealth_address, salary_rate)
    }

    pub fn fund_batch(ctx: Context<FundBatch>, amount: u64) -> Result<()> {
        handlers::payroll::fund_batch(ctx, amount)
    }

    pub fn claim_salary(ctx: Context<ClaimSalary>) -> Result<()> {
        handlers::payroll::claim_salary(ctx)
    }

    pub fn update_salary_rate(ctx: Context<UpdateSalaryRate>, new_rate: u64) -> Result<()> {
        handlers::payroll::update_salary_rate(ctx, new_rate)
    }

    pub fn set_employee_status(ctx: Context<SetEmployeeStatus>, new_status: EmployeeStatus) -> Result<()> {
        handlers::payroll::set_employee_status(ctx, new_status)
    }

    // ==============================================
    // ANONYMOUS RECEIPTS
    // ==============================================

    pub fn create_receipt(ctx: Context<CreateReceipt>, receipt_secret: [u8; 32]) -> Result<()> {
        handlers::receipt::create(ctx, receipt_secret)
    }

    pub fn verify_receipt(
        ctx: Context<VerifyReceipt>,
        employee_wallet: Pubkey,
        batch_key: Pubkey,
        timestamp: i64,
        amount: u64,
        secret: [u8; 32],
    ) -> Result<()> {
        handlers::receipt::verify(ctx, employee_wallet, batch_key, timestamp, amount, secret)
    }

    pub fn verify_receipt_blind(
        ctx: Context<VerifyReceiptBlind>,
        employee_wallet: Pubkey,
        timestamp_range_start: i64,
        timestamp_range_end: i64,
    ) -> Result<()> {
        handlers::receipt::verify_blind(ctx, employee_wallet, timestamp_range_start, timestamp_range_end)
    }

    // ==============================================
    // COMMITMENT-BASED PRIVACY (ZK-LIKE)
    // ==============================================

    pub fn private_deposit(
        ctx: Context<PrivateDeposit>,
        commitment: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        handlers::commitment::deposit(ctx, commitment, amount)
    }

    pub fn private_withdraw(
        ctx: Context<PrivateWithdraw>,
        nullifier: [u8; 32],
        secret_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        handlers::commitment::withdraw(ctx, nullifier, secret_hash, amount)
    }
}
