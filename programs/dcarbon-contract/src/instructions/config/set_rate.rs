use anchor_lang::prelude::*;

use crate::instructions::SetConfig;

pub fn set_rate(ctx: Context<SetConfig>, rate: u64) -> Result<()> {
    let contract_config = &mut ctx.accounts.contract_config;

    contract_config.rate = rate;

    Ok(())
}