//! Program constants for Offuscate
//!
//! Contains all constant values used across the program.

/// Minimum delay before withdrawal can be claimed (in seconds)
pub const MIN_DELAY_SECONDS: i64 = 30; // 30 seconds minimum

/// Maximum delay for withdrawal (in seconds)
pub const MAX_DELAY_SECONDS: i64 = 300; // 5 minutes maximum

/// Allowed withdrawal amounts in lamports (standardized to break amount correlation)
pub const ALLOWED_AMOUNTS: [u64; 3] = [
    100_000_000,   // 0.1 SOL
    500_000_000,   // 0.5 SOL
    1_000_000_000, // 1.0 SOL
];
