use anchor_lang::prelude::*;

use crate::ID;
use crate::state::*;

pub fn register_device(ctx: Context<RegisterDevice>, register_device_args: RegisterDeviceArgs) -> Result<()> {
    let device = &mut ctx.accounts.device;

    // assign data for device
    device.assign_value(register_device_args)?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(register_device_args: RegisterDeviceArgs)]
pub struct RegisterDevice<'info> {
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
        init,
        payer = signer,
        space = 8 + Device::INIT_SPACE,
        seeds = [Device::PREFIX_SEED, &register_device_args.project_id.to_le_bytes(), &register_device_args.device_id.to_le_bytes()],
        bump
    )]
    pub device: Account<'info, Device>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + DeviceStatus::INIT_SPACE,
        seeds = [DeviceStatus::PREFIX_SEED, &register_device_args.device_id.to_le_bytes()],
        bump
    )]
    pub device_status: Account<'info, DeviceStatus>,

    pub system_program: Program<'info, System>,
}

#[derive(InitSpace, Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterDeviceArgs {
    pub project_id: u16,
    pub device_id: u16,
    pub device_type: u16,
    pub owner: Pubkey,
    pub minter: Pubkey
}

