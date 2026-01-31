//! Campaign State
//!
//! Accounts for crowdfunding campaigns:
//! - Campaign: Campaign details and stats
//! - StealthRegistry: Records stealth payments for scanning
//! - CampaignStatus: Campaign lifecycle status

use anchor_lang::prelude::*;

/// Campaign status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CampaignStatus {
    Active,
    Closed,
    Completed,
}

/// Campaign account - stores campaign details
#[account]
pub struct Campaign {
    pub owner: Pubkey,                   // 32 bytes
    pub campaign_id: String,             // 4 + 32 = 36 bytes
    pub title: String,                   // 4 + 64 = 68 bytes
    pub description: String,             // 4 + 256 = 260 bytes
    pub goal: u64,                       // 8 bytes
    pub total_raised: u64,               // 8 bytes (vault donations)
    pub donor_count: u64,                // 8 bytes
    pub deadline: i64,                   // 8 bytes
    pub status: CampaignStatus,          // 1 byte
    pub created_at: i64,                 // 8 bytes
    pub vault_bump: u8,                  // 1 byte
    pub campaign_bump: u8,               // 1 byte
    // Stealth fields
    pub stealth_meta_address: String,    // 4 + 200 = 204 bytes (st:viewPub:spendPub)
    pub stealth_donations: u64,          // 8 bytes (count of stealth donations)
    pub stealth_total: u64,              // 8 bytes (total stealth amount - for display)
}

impl Campaign {
    pub const SPACE: usize = 8 +  // discriminator
        32 +                       // owner
        (4 + 32) +                // campaign_id
        (4 + 64) +                // title
        (4 + 256) +               // description
        8 +                        // goal
        8 +                        // total_raised
        8 +                        // donor_count
        8 +                        // deadline
        1 +                        // status
        8 +                        // created_at
        1 +                        // vault_bump
        1 +                        // campaign_bump
        (4 + 200) +               // stealth_meta_address
        8 +                        // stealth_donations
        8 +                        // stealth_total
        64;                        // padding for safety
}

/// Registry entry for a stealth payment
/// Stores metadata so recipient can scan and identify their payments
#[account]
pub struct StealthRegistry {
    pub campaign: Pubkey,           // 32 bytes - which campaign
    pub stealth_address: Pubkey,    // 32 bytes - the stealth address
    pub ephemeral_pub_key: String,  // 4 + 64 = 68 bytes - for recipient to derive
    pub amount: u64,                // 8 bytes - amount sent
    pub timestamp: i64,             // 8 bytes - when
    pub bump: u8,                   // 1 byte
}

impl StealthRegistry {
    pub const SPACE: usize = 8 +   // discriminator
        32 +                        // campaign
        32 +                        // stealth_address
        (4 + 64) +                  // ephemeral_pub_key
        8 +                         // amount
        8 +                         // timestamp
        1 +                         // bump
        16;                         // padding
}
