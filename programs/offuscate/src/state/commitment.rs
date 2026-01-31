//! Commitment-based Privacy State
//!
//! ZK-like privacy using commitments and nullifiers:
//! - CommitmentPDA: Stores deposit commitments
//! - NullifierPDA: Tracks used nullifiers to prevent double-spend

use anchor_lang::prelude::*;

/// Individual PDA for each commitment
/// Created when a private deposit is made
/// Stores: commitment hash, amount, timestamp, spent status
#[account]
pub struct CommitmentPDA {
    pub commitment: [u8; 32],  // 32 bytes - the commitment hash
    pub amount: u64,           // 8 bytes - deposited amount
    pub timestamp: i64,        // 8 bytes - when deposited
    pub spent: bool,           // 1 byte - has this been withdrawn
    pub bump: u8,              // 1 byte
}

impl CommitmentPDA {
    pub const SPACE: usize = 8 +   // discriminator
        32 +                        // commitment
        8 +                         // amount
        8 +                         // timestamp
        1 +                         // spent
        1 +                         // bump
        16;                         // padding
}

/// Individual PDA for each used nullifier
/// Created when a private withdrawal is made
/// Existence of this PDA proves the nullifier has been used
#[account]
pub struct NullifierPDA {
    pub nullifier: [u8; 32],   // 32 bytes - the nullifier hash
    pub used_at: i64,          // 8 bytes - when used
    pub bump: u8,              // 1 byte
}

impl NullifierPDA {
    pub const SPACE: usize = 8 +   // discriminator
        32 +                        // nullifier
        8 +                         // used_at
        1 +                         // bump
        16;                         // padding
}
