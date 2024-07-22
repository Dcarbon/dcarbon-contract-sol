use anchor_lang::prelude::*;
use mpl_token_metadata::instructions::MintCpiBuilder;
use mpl_token_metadata::types::MintArgs;

use crate::*;
use crate::error::DCarbonError;
use crate::state::{Device, DeviceStatus};

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintSftArgs {
    project_id: String,
    device_id: String,
    mint_data_vec: Vec<u8>,
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VerifyMessageArgs {
    hash: Vec<u8>,
    recovery_id: u8,
    signature: Vec<u8>,
    expected: Vec<u8>,
}

pub fn mint_sft(ctx: Context<MintSft>, mint_sft_args: MintSftArgs, _verify_message_args: VerifyMessageArgs) -> Result<()> {
    let mint = &ctx.accounts.mint;
    let signer = &ctx.accounts.signer;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;
    let metadata = &ctx.accounts.metadata;
    let authority = &ctx.accounts.authority;
    let device_status = &ctx.accounts.device_status;

    // // check mint key with device mint
    // assert_keys_equal(&device.mint, &mint.key())?;

    // check is active
    if !device_status.is_active {
        return Err(DCarbonError::DeviceIsNotActive.into());
    }

    let seeds: &[&[u8]] = &[b"authority"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    let mint_data = MintArgs::try_from_slice(&mint_sft_args.mint_data_vec).unwrap();

    MintCpiBuilder::new(&ctx.accounts.token_metadata_program)
        .token(&ctx.accounts.to_ata)
        .token_owner(Some(&ctx.accounts.destination))
        .metadata(metadata)
        .master_edition(None)
        .token_record(None)
        .mint(&mint.to_account_info())
        .authority(authority)
        .delegate_record(None)
        .payer(&signer.to_account_info())
        .system_program(&system_program.to_account_info())
        .sysvar_instructions(&ctx.accounts.sysvar_program)
        .spl_token_program(token_program)
        .spl_ata_program(&ctx.accounts.ata_program)
        .authorization_rules(None)
        .authorization_rules_program(None)
        .mint_args(mint_data)
        .invoke_signed(&[seeds_signer])?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(mint_sft_args: MintSftArgs)]
pub struct MintSft<'info> {
    #[account(
        mut,
        constraint = signer.key() == device.minter,
    )]
    pub signer: Signer<'info>,

    /// CHECK:
    #[account(
        constraint = destination.key() == device.destination
    )]
    pub destination: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK:
    pub to_ata: AccountInfo<'info>,

    #[account(
        seeds = [Device::PREFIX_SEED, mint_sft_args.project_id.as_bytes(), mint_sft_args.device_id.as_bytes()],
        bump,
        owner = ID,
    )]
    pub device: Account<'info, Device>,

    #[account(
        seeds = [DeviceStatus::PREFIX_SEED, device.key().as_ref()],
        bump,
        owner = ID,
    )]
    pub device_status: Account<'info, DeviceStatus>,

    #[account(
        seeds = [b"authority"],
        bump,
        owner = ID
    )]
    /// CHECK:
    pub authority: AccountInfo<'info>,

    /// CHECK:
    #[account(mut)]
    pub mint: AccountInfo<'info>,

    /// CHECK:
    pub metadata: AccountInfo<'info>,

    /// CHECK:
    pub token_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK:
    pub sysvar_program: AccountInfo<'info>,

    /// CHECK:
    pub token_metadata_program: AccountInfo<'info>,

    /// CHECK:
    pub ata_program: AccountInfo<'info>,
}