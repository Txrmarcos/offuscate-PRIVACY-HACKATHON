//! Instructions module - Account contexts for Offuscate
//!
//! Each module contains the #[derive(Accounts)] structs for related instructions.
//! The instruction handlers themselves remain in lib.rs.
//!
//! Organized by feature:
//! - privacy_pool: Pool operations (deposit, withdraw, claim)
//! - campaign: Campaign CRUD operations
//! - stealth: Stealth address operations
//! - invite: Invite system operations
//! - payroll: Streaming payroll operations
//! - receipt: Anonymous receipt operations
//! - commitment: Commitment-based privacy operations
//! - relayer: Relayer-assisted operations

pub mod privacy_pool;
pub mod campaign;
pub mod stealth;
pub mod invite;
pub mod payroll;
pub mod receipt;
pub mod commitment;
pub mod relayer;

// Re-export all contexts
pub use privacy_pool::*;
pub use campaign::*;
pub use stealth::*;
pub use invite::*;
pub use payroll::*;
pub use receipt::*;
pub use commitment::*;
pub use relayer::*;
