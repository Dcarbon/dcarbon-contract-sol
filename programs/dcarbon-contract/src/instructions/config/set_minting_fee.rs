use anchor_lang::prelude::*;

use crate::instructions::SetConfig;

    pub fn set_minting_fee(ctx: Context<SetConfig>, minting_fee: f64) -> Result<()> {
    let contract_config = &mut ctx.accounts.contract_config;

    contract_config.minting_fee = minting_fee;

    Ok(())
}