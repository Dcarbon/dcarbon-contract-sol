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

    pub fn init_config(
        ctx: Context<InitConfig>,
        config_args: ConfigArgs,
    ) -> Result<()> {
        instructions::init_config(ctx, config_args)
    }

    pub fn set_minting_fee(ctx: Context<SetConfig>, minting_fee: f64) -> Result<()> {
        instructions::set_minting_fee(ctx, minting_fee)
    }

    pub fn set_minting_limit(ctx: Context<SetConfig>, device_type: u16, limit: f64) -> Result<()> {
        instructions::set_minting_limit(ctx, device_type, limit)
    }

    pub fn set_rate(ctx: Context<SetConfig>, rate: f64) -> Result<()> {
        instructions::set_rate(ctx, rate)
    }

    pub fn set_coefficient(ctx: Context<SetCoefficient>, key: String, value: u64) -> Result<()> {
        instructions::set_coefficient(ctx, key, value)
    }

    pub fn register_device(ctx: Context<RegisterDevice>, register_device_args: RegisterDeviceArgs) -> Result<()> {
        instructions::register_device(ctx, register_device_args)
    }

    pub fn set_active(ctx: Context<SetActive>, project_id: u16, device_id: u16) -> Result<()> {
        instructions::set_active(ctx, project_id, device_id)
    }

    pub fn mint_sft<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, MintSft<'info>>,
        mint_sft_args: MintSftArgs,
        verify_message_args: VerifyMessageArgs,
    ) -> Result<()> {
        instructions::mint_sft(ctx, mint_sft_args, verify_message_args)
    }

    pub fn swap_sft(ctx: Context<SwapSft>, burn_data_vec: Vec<u8>, mint_data_vec: Vec<u8>) -> Result<()> {
        instructions::swap_sft(ctx, burn_data_vec, mint_data_vec)
    }

    pub fn listing<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, Listing<'info>>,
        listing_args: ListingArgs,
    ) -> Result<()> {
        instructions::listing(ctx, listing_args)
    }

    pub fn buy<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, Buy<'info>>,
        amount: f64,
    ) -> Result<()> {
        instructions::buy(ctx, amount)
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        instructions::cancel_listing(ctx)
    }

    pub fn create_collection(
        ctx: Context<CreateCollection>,
        uri: String,
        name: String,
        symbol: String,
    ) -> Result<()> {
        instructions::create_collection(ctx, uri, name, symbol)
    }

    pub fn burn_sft(ctx: Context<BurnSft>, amount: f64) -> Result<()> {
        instructions::burn_sft(ctx, amount)
    }

    pub fn mint_nft(
        ctx: Context<MintNft>,
        uri: String,
        name: String,
        symbol: String,
        amount: f64,
    ) -> Result<()> {
        instructions::mint_nft(ctx, uri, name, symbol, amount)
    }

    pub fn claim_governance_token(ctx: Context<ClaimGovernanceToken>) -> Result<()> {
        instructions::claim_governance_token(ctx)
    }
}