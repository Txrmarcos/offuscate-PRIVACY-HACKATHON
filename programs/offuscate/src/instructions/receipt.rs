//! Receipt Account Contexts
//!
//! Anonymous receipt operations for proving payments without revealing amounts:
//! - CreateReceipt: Employee creates a receipt after claiming salary
//! - VerifyReceipt: Anyone can verify a receipt (public verification)
//! - VerifyReceiptBlind: Blind verification (proves existence, not amount)

use anchor_lang::prelude::*;
use crate::state::{PayrollBatch, Employee, PaymentReceipt};
use crate::errors::ErrorCode;

/// Create an anonymous receipt after claiming salary
///
/// The receipt contains a commitment that hides the amount:
/// commitment = hash(employee || batch || timestamp || amount || secret)
///
/// Use cases:
/// - Prove employment without revealing salary
/// - Prove payment was received at a specific time
/// - Optionally reveal secret for full amount verification
#[derive(Accounts)]
pub struct CreateReceipt<'info> {
    #[account(mut)]
    pub employee_signer: Signer<'info>,

    #[account(
        constraint = employee.wallet == employee_signer.key() @ ErrorCode::Unauthorized
    )]
    pub employee: Account<'info, Employee>,

    #[account(
        constraint = batch.key() == employee.batch @ ErrorCode::Unauthorized
    )]
    pub batch: Account<'info, PayrollBatch>,

    #[account(
        init,
        payer = employee_signer,
        space = PaymentReceipt::SPACE,
        seeds = [
            b"receipt",
            employee.wallet.as_ref(),
            batch.key().as_ref(),
            &employee.total_claimed.to_le_bytes()
        ],
        bump
    )]
    pub receipt: Account<'info, PaymentReceipt>,

    pub system_program: Program<'info, System>,
}

/// Verify a receipt (public verification)
///
/// Anyone can verify that a receipt exists and was created by the program.
/// This proves the employee was paid, but doesn't reveal the amount
/// (unless the employee reveals the secret).
#[derive(Accounts)]
pub struct VerifyReceipt<'info> {
    /// Anyone can verify a receipt
    pub verifier: Signer<'info>,

    /// The receipt to verify
    pub receipt: Account<'info, PaymentReceipt>,
}

/// Blind verification of a receipt
///
/// Verifies that a receipt exists without reading any data from it.
/// Useful for proving "I have received payment from employer X"
/// without revealing when, how much, or how often.
#[derive(Accounts)]
pub struct VerifyReceiptBlind<'info> {
    /// Anyone can do blind verification
    pub verifier: Signer<'info>,

    /// The receipt to verify (blind)
    pub receipt: Account<'info, PaymentReceipt>,
}
