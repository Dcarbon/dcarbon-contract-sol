use anchor_lang::prelude::*;

use crate::state::{Admin, Device, DeviceStatus};
use crate::ID;

pub fn set_active(ctx: Context<SetActive>, _project_id: String, _device_id: String) -> Result<()> {
    let device_status = &mut ctx.accounts.device_status;

    let is_active = device_status.is_active;

    device_status.is_active = !is_active;

    Ok(())
}

#[derive(Accounts)]
#[instruction(_project_id: String, _device_id: String)]
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
        seeds = [Device::PREFIX_SEED, _project_id.as_bytes(), _device_id.as_bytes()],
        bump,
        owner = ID,
    )]
    pub device: Account<'info, Device>,

    #[account(
        mut,
        seeds = [DeviceStatus::PREFIX_SEED, device.key().as_ref()],
        bump,
        owner = ID,
    )]
    pub device_status: Account<'info, DeviceStatus>,
}