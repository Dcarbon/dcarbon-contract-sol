use anchor_lang::prelude::*;

use instructions::*;

mod state;
mod instructions;
mod error;
mod utils;

declare_id!("75eELePzbpEwD1tAEvYna5ZJtC26GeU42uF3ycyyTCt2");

#[program]
pub mod dcarbon_contract {
    use super::*;

    pub fn add_admin<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, AddAdmin<'info>>,
        address: Pubkey,
    ) -> Result<()> {
        instructions::add_admin(ctx, address)
    }

    pub fn delete_admin(ctx: Context<DeleteAdmin>, address: Pubkey) -> Result<()> {
        instructions::delete_admin(ctx, address)
    }

    pub fn init_master<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InitMaster<'info>>,
        address: Pubkey,
    ) -> Result<()> {
        instructions::init_master(ctx, address)
    }

    pub fn transfer_master_rights(
        ctx: Context<TransferMasterRights>,
        new_master_address: Pubkey,
    ) -> Result<()> {
        instructions::transfer_master_rights(ctx, new_master_address)
    }

    pub fn create_ft<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, CreateFt<'info>>,
        create_ft_args: CreateFtArgs,
    ) -> Result<()> {
        instructions::create_ft(ctx, create_ft_args)
    }

    pub fn init_config<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InitConfig<'info>>,
        config_args: ConfigArgs,
    ) -> Result<()> {
        instructions::init_config(ctx, config_args)
    }

    pub fn set_minting_fee(ctx: Context<SetConfig>, minting_fee: u64) -> Result<()> {
        instructions::set_minting_fee(ctx, minting_fee)
    }

    pub fn set_minting_limit(ctx: Context<SetConfig>, device_type: u16, limit: u16) -> Result<()> {
        instructions::set_minting_limit(ctx, device_type, limit)
    }

    pub fn set_rate(ctx: Context<SetConfig>, rate: u64) -> Result<()> {
        instructions::set_rate(ctx, rate)
    }

    pub fn set_coefficient(ctx: Context<SetCoefficient>, device_id: String, value: u64) -> Result<()> {
        instructions::set_coefficient(ctx, device_id, value)
    }

    pub fn register_device(ctx: Context<RegisterDevice>, register_device_args: RegisterDeviceArgs) -> Result<()> {
        instructions::register_device(ctx, register_device_args)
    }

    pub fn set_active(ctx: Context<SetActive>, project_id: String, device_id: String) -> Result<()> {
        instructions::set_active(ctx, project_id, device_id)
    }

    pub fn mint_sft(ctx: Context<MintSft>, mint_sft_args: MintSftArgs, verify_message_args: VerifyMessageArgs) -> Result<()> {
        instructions::mint_sft(ctx, mint_sft_args, verify_message_args)
    }
}