//! Anonymous Receipt State
//!
//! Commitment-based receipts for proving payments without revealing amounts:
//! - PaymentReceipt: Proves payment was made (amount hidden via commitment)

use anchor_lang::prelude::*;

/// Anonymous Payment Receipt
/// Proves payment was received without revealing the amount
///
/// Privacy Model:
/// - commitment = hash(employee || batch || timestamp || amount || secret)
/// - The employee keeps the secret
/// - To prove payment: reveal (employee, batch, timestamp) + show receipt exists
/// - To prove specific amount: reveal secret (optional, for full audits)
///
/// Use cases:
/// - Bank: "Prove you have income" → Show receipt, proves employment
/// - Visa: "Prove you're employed" → Show receipt from recent date
/// - Audit: "Prove specific amount" → Reveal secret for full verification
#[account]
pub struct PaymentReceipt {
    pub employee: Pubkey,           // 32 bytes - employee wallet
    pub batch: Pubkey,              // 32 bytes - which batch paid
    pub employer: Pubkey,           // 32 bytes - employer (batch owner)
    pub commitment: [u8; 32],       // 32 bytes - hash commitment (hides amount)
    pub timestamp: i64,             // 8 bytes - when payment was made
    pub receipt_index: u64,         // 8 bytes - unique index for this receipt
    pub bump: u8,                   // 1 byte
}

impl PaymentReceipt {
    pub const SPACE: usize = 8 +    // discriminator
        32 +                         // employee
        32 +                         // batch
        32 +                         // employer
        32 +                         // commitment
        8 +                          // timestamp
        8 +                          // receipt_index
        1 +                          // bump
        32;                          // padding
}
