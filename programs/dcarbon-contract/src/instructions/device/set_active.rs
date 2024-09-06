use anchor_lang::prelude::*;

use crate::error::DCarbonError;
use crate::state::{Admin, Device, DeviceStatus};
use crate::ID;

pub fn set_active(ctx: Context<SetActive>, project_id: u16, device_id: u16) -> Result<()> {
    let device_status = &mut ctx.accounts.device_status;

    let is_active = device_status.is_active;

    // check project_id and device_id
    if project_id <= 0 {
        return Err(DCarbonError::InvalidProjectId.into());
    }

    if device_id <= 0 {
        return Err(DCarbonError::InvalidDeviceId.into());
    }

    device_status.is_active = !is_active;

    Ok(())
}

#[derive(Accounts)]
#[instruction(project_id: u16, device_id: u16)]
pub struct SetActive<'info> {
    #[account(
        mut,
        constraint = signer.key() == admin_pda.admin_key,
    )]
    pub signer: Signer<'info>,

    #[account(
        seeds = [Admin::PREFIX_SEED, signer.key().as_ref()],
        bump,
        owner = ID,
    )]
    pub admin_pda: Account<'info, Admin>,

    #[account(
        seeds = [Device::PREFIX_SEED, & project_id.to_le_bytes(), & device_id.to_le_bytes()],
        bump,
        owner = ID,
    )]
    pub device: Account<'info, Device>,

    #[account(
        mut,
        seeds = [DeviceStatus::PREFIX_SEED, & device_id.to_le_bytes()],
        bump,
        owner = ID,
    )]
    pub device_status: Account<'info, DeviceStatus>,
}
