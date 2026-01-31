//! State module - Account structures for Offuscate
//!
//! Organized by feature:
//! - privacy_pool: Privacy pool, pending withdrawals, churn vaults
//! - campaign: Campaigns and stealth registry
//! - commitment: Commitment-based privacy (ZK-like)
//! - invite: Invite system for onboarding
//! - payroll: Streaming payroll (master vault, batches, employees)
//! - receipt: Anonymous payment receipts

pub mod privacy_pool;
pub mod campaign;
pub mod commitment;
pub mod invite;
pub mod payroll;
pub mod receipt;

// Re-export all state types
pub use privacy_pool::*;
pub use campaign::*;
pub use commitment::*;
pub use invite::*;
pub use payroll::*;
pub use receipt::*;
