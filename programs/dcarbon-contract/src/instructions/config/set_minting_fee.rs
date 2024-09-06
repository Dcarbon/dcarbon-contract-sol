use anchor_lang::prelude::*;

use crate::error::DCarbonError;
use crate::instructions::SetConfig;

pub fn set_minting_fee(ctx: Context<SetConfig>, minting_fee: f64) -> Result<()> {
    let contract_config = &mut ctx.accounts.contract_config;

    if minting_fee <= 0.0 {
        return Err(DCarbonError::InvalidNumber.into());
    }

    contract_config.minting_fee = minting_fee;

    Ok(())
}
