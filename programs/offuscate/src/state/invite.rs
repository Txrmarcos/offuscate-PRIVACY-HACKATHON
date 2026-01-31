//! Invite System State
//!
//! Accounts for employee onboarding via invites:
//! - Invite: Invitation to join a payroll batch
//! - InviteStatus: Invite lifecycle status

use anchor_lang::prelude::*;

/// Invite status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum InviteStatus {
    Pending,
    Accepted,
    Revoked,
}

/// Invite account - stores invitation for a recipient to join a payroll batch
#[account]
pub struct Invite {
    pub batch: Pubkey,                      // 32 bytes - which batch (campaign) this invite is for
    pub invite_code: String,                // 4 + 16 = 20 bytes - unique code
    pub creator: Pubkey,                    // 32 bytes - employer who created it
    pub recipient: Pubkey,                  // 32 bytes - recipient wallet (zero if pending)
    pub recipient_stealth_address: String,  // 4 + 200 = 204 bytes - recipient's stealth meta address
    pub salary_rate: u64,                   // 8 bytes - lamports per second (0 = no streaming)
    pub status: InviteStatus,               // 1 byte
    pub created_at: i64,                    // 8 bytes
    pub accepted_at: i64,                   // 8 bytes (0 if not accepted)
    pub bump: u8,                           // 1 byte
}

impl Invite {
    pub const SPACE: usize = 8 +   // discriminator
        32 +                        // batch
        (4 + 16) +                  // invite_code
        32 +                        // creator
        32 +                        // recipient
        (4 + 200) +                 // recipient_stealth_address
        8 +                         // salary_rate
        1 +                         // status
        8 +                         // created_at
        8 +                         // accepted_at
        1 +                         // bump
        32;                         // padding
}
