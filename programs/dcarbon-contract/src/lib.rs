use anchor_lang::prelude::*;

declare_id!("bM6u1BRUQiFD1xEDPpqqGMMoLExtnmiPeb8NtXPDtg3");

#[program]
pub mod dcarbon_contract {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
