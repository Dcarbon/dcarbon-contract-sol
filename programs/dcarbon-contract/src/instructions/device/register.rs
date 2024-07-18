use anchor_lang::prelude::*;
use mpl_token_metadata::instructions::CreateCpiBuilder;
use mpl_token_metadata::types::CreateArgs;

use crate::ID;
use crate::state::*;

pub fn register_device(ctx: Context<RegisterDevice>, register_device_args: RegisterDeviceArgs, metadata_vec: Vec<u8>) -> Result<()> {
    let device = &mut ctx.accounts.device;
    let mint = &ctx.accounts.mint;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;
    let metadata = &ctx.accounts.metadata;
    let authority = &ctx.accounts.authority;
    let signer = &ctx.accounts.signer;

    // assign data for device
    device.assign_value(register_device_args, mint.key())?;

    // create semi fungible-token for each device
    let seeds: &[&[u8]] = &[b"authority"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    let create_data = CreateArgs::try_from_slice(&metadata_vec).unwrap();

    CreateCpiBuilder::new(&ctx.accounts.token_metadata_program)
        .metadata(metadata)
        .master_edition(None)
        .mint(&mint.to_account_info(), true)
        .authority(&authority.to_account_info())
        .payer(&signer.to_account_info())
        .update_authority(&authority.to_account_info(), true)
        .system_program(&system_program.to_account_info())
        .sysvar_instructions(&ctx.accounts.sysvar_program)
        .spl_token_program(Some(&token_program.to_account_info()))
        .create_args(create_data)
        .invoke_signed(&[seeds_signer])?;

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
        seeds = [Device::PREFIX_SEED, register_device_args.project_id.as_bytes(), register_device_args.device_id.as_bytes()],
        bump
    )]
    pub device: Account<'info, Device>,

    #[account(
        init,
        payer = signer,
        space = 8 + DeviceStatus::INIT_SPACE,
        seeds = [DeviceStatus::PREFIX_SEED, device.key().as_ref()],
        bump
    )]
    pub device_status: Account<'info, DeviceStatus>,

    #[account(
        seeds = [b"authority"],
        bump,
        owner = ID
    )]
    /// CHECK:
    pub authority: AccountInfo<'info>,

    // mint account for sft
    /// CHECK:
    #[account(mut)]
    pub mint: Signer<'info>,

    #[account(mut)]
    /// CHECK:
    pub metadata: AccountInfo<'info>,

    /// CHECK:
    pub token_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK:
    pub sysvar_program: AccountInfo<'info>,

    /// CHECK:
    pub token_metadata_program: AccountInfo<'info>,
}

#[derive(InitSpace, Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterDeviceArgs {
    #[max_len(24)]
    pub project_id: String,
    #[max_len(24)]
    pub device_id: String,
    pub device_type: u16,
    pub destination: Pubkey,
    pub minter: Pubkey
}

