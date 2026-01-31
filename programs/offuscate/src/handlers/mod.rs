//! Handlers module - Instruction logic for Offuscate
//!
//! Each module contains the business logic for related instructions.
//! The account contexts are defined in the instructions/ module.
//!
//! Organized by feature:
//! - privacy_pool: Pool operations (deposit, withdraw, churn)
//! - relayer: Relayer-assisted gasless operations
//! - campaign: Campaign CRUD operations
//! - stealth: Stealth address operations
//! - invite: Invite system operations
//! - payroll: Streaming payroll operations
//! - receipt: Anonymous receipt operations
//! - commitment: Commitment-based privacy operations

pub mod privacy_pool;
pub mod relayer;
pub mod campaign;
pub mod stealth;
pub mod invite;
pub mod payroll;
pub mod receipt;
pub mod commitment;
