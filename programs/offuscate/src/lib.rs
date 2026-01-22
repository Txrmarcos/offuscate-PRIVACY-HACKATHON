use anchor_lang::prelude::*;

declare_id!("4AVSsa2pgPoVSNs3KmXJZvXq8QLtBwXzq3VFACGKajTq");

#[program]
pub mod offuscate {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
