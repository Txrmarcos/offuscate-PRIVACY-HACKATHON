//! Error codes for Offuscate program
//!
//! All custom error types used by the program.

use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // ============================================
    // Campaign errors
    // ============================================
    #[msg("Campaign ID too long (max 32 chars)")]
    CampaignIdTooLong,
    #[msg("Title too long (max 64 chars)")]
    TitleTooLong,
    #[msg("Description too long (max 256 chars)")]
    DescriptionTooLong,
    #[msg("Invalid goal amount")]
    InvalidGoal,
    #[msg("Invalid deadline")]
    InvalidDeadline,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Campaign is not active")]
    CampaignNotActive,
    #[msg("Campaign has ended")]
    CampaignEnded,
    #[msg("Campaign has not ended yet")]
    CampaignNotEnded,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Stealth meta-address too long (max 200 chars)")]
    MetaAddressTooLong,
    #[msg("Ephemeral public key too long (max 64 chars)")]
    EphemeralKeyTooLong,

    // ============================================
    // Privacy Pool errors
    // ============================================
    #[msg("Invalid withdrawal amount. Must be 0.1, 0.5, or 1 SOL")]
    InvalidWithdrawAmount,
    #[msg("Insufficient funds in privacy pool")]
    InsufficientPoolFunds,
    #[msg("Withdrawal not ready yet. Please wait for delay period")]
    WithdrawNotReady,
    #[msg("Withdrawal already claimed")]
    AlreadyClaimed,

    // ============================================
    // Batch withdrawal errors
    // ============================================
    #[msg("Batch too small - need at least 1 withdrawal (2 accounts)")]
    BatchTooSmall,
    #[msg("Batch accounts must be pairs (recipient + pending)")]
    BatchInvalidPairs,
    #[msg("Batch too large - max 5 withdrawals (10 accounts)")]
    BatchTooLarge,

    // ============================================
    // Churn errors
    // ============================================
    #[msg("Invalid churn vault index (must be 0, 1, or 2)")]
    InvalidChurnIndex,
    #[msg("Insufficient funds in churn vault")]
    InsufficientChurnFunds,

    // ============================================
    // Relayer errors
    // ============================================
    #[msg("Invalid ed25519 signature instruction")]
    InvalidSignatureInstruction,
    #[msg("Signer does not match pending withdrawal recipient")]
    SignerMismatch,
    #[msg("Invalid claim message format (expected 'claim:<pda>')")]
    InvalidClaimMessage,

    // ============================================
    // Commitment-based privacy errors
    // ============================================
    #[msg("Nullifier has already been used (double-spend attempt)")]
    NullifierAlreadyUsed,
    #[msg("Invalid commitment proof - preimage does not match stored commitment")]
    InvalidCommitmentProof,
    #[msg("Commitment has already been spent")]
    CommitmentAlreadySpent,

    // ============================================
    // Invite system errors
    // ============================================
    #[msg("Invite code too long (max 16 chars)")]
    InviteCodeTooLong,
    #[msg("Invite code too short (min 6 chars)")]
    InviteCodeTooShort,
    #[msg("Invite is not in pending status")]
    InviteNotPending,
    #[msg("Stealth address is required")]
    StealthAddressRequired,
    #[msg("Invite not found")]
    InviteNotFound,
    #[msg("Invite has no salary configured - use accept_invite instead")]
    InviteNoSalaryConfigured,

    // ============================================
    // Streaming payroll errors
    // ============================================
    #[msg("Employee not active")]
    EmployeeNotActive,
    #[msg("No salary to claim")]
    NoSalaryToClaim,
    #[msg("Invalid salary rate")]
    InvalidSalaryRate,
    #[msg("Employee already exists")]
    EmployeeAlreadyExists,

    // ============================================
    // Anonymous receipt errors
    // ============================================
    #[msg("Invalid receipt proof - commitment does not match")]
    InvalidReceiptProof,
    #[msg("Receipt employee does not match provided employee")]
    ReceiptEmployeeMismatch,
    #[msg("Receipt batch does not match provided batch")]
    ReceiptBatchMismatch,
    #[msg("Receipt timestamp does not match provided timestamp")]
    ReceiptTimestampMismatch,
    #[msg("Receipt not found")]
    ReceiptNotFound,
}
