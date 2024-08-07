use anchor_lang::prelude::*;

use crate::instructions::SetConfig;
use crate::state::DeviceLimit;

pub fn set_minting_limit(ctx: Context<SetConfig>, device_type: u16, limit: f64) -> Result<()> {
    let contract_config = &mut ctx.accounts.contract_config;

    if let Some(device) = contract_config.minting_limits.iter_mut().find(|d| d.device_type == device_type) {
        device.limit = limit;
    } else {
        contract_config.minting_limits.push(DeviceLimit {
            device_type,
            limit,
        });
    }

    Ok(())
}