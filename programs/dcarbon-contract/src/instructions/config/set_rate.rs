use crate::error::DCarbonError;
use anchor_lang::prelude::*;

use crate::instructions::SetConfig;

pub fn set_rate(ctx: Context<SetConfig>, rate: f64) -> Result<()> {
    let contract_config = &mut ctx.accounts.contract_config;

    if rate <= 0.0 {
        return Err(DCarbonError::InvalidNumber.into());
    }
    contract_config.rate = rate;

    Ok(())
}
