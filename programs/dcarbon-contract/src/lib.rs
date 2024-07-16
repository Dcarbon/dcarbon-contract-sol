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

    pub fn create_mint(ctx: Context<CreateMint>, create_data_vec: Vec<u8>) -> Result<()> {
        instructions::create_mint(ctx, create_data_vec)
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

    pub fn register_device(ctx: Context<RegisterDevice>, register_device_args: RegisterDeviceArgs, metadata_vec: Vec<u8>) -> Result<()> {
        instructions::register_device(ctx, register_device_args, metadata_vec)
    }

    pub fn set_active(ctx: Context<SetActive>, project_id: String, device_id: String) -> Result<()> {
        instructions::set_active(ctx, project_id, device_id)
    }

    pub fn mint_token(ctx: Context<MintToken>, project_id: String, device_id: String, mint_data_vec: Vec<u8>) -> Result<()> {
        instructions::mint_token(ctx, project_id, device_id, mint_data_vec)
    }
}