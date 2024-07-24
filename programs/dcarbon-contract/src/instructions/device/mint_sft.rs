use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use mpl_token_metadata::instructions::{CreateCpiBuilder, MintCpiBuilder};
use mpl_token_metadata::types::{CreateArgs, MintArgs};

use crate::*;
use crate::error::DCarbonError;
use crate::state::{ContractConfig, Device, DeviceStatus};
use crate::utils::assert_keys_equal;

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintSftArgs {
    project_id: String,
    device_id: String,
    create_mint_data_vec: Vec<u8>,
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
    let contract_config = &ctx.accounts.contract_config;
    let destination_ata = &ctx.accounts.destination_ata;
    let token_metadata_program = &ctx.accounts.token_metadata_program;
    let destination = &ctx.accounts.destination;

    // check is active
    if !device_status.is_active {
        return Err(DCarbonError::DeviceIsNotActive.into());
    }

    let seeds: &[&[u8]] = &[b"authority"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    // create mint
    let create_data = CreateArgs::try_from_slice(&mint_sft_args.create_mint_data_vec).unwrap();

    CreateCpiBuilder::new(token_metadata_program)
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

    // mint for owner
    let mint_data = MintArgs::try_from_slice(&mint_sft_args.mint_data_vec).unwrap();

    MintCpiBuilder::new(token_metadata_program)
        .token(&ctx.accounts.owner_ata)
        .token_owner(Some(&ctx.accounts.device_owner))
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
        .mint_args(mint_data.clone())
        .invoke_signed(&[seeds_signer])?;

    // increase something
    match &mint_data {
        MintArgs::V1 { amount, .. } => {
            let total_amount = amount / (1u64 - contract_config.minting_fee * 1e9 as u64);

            let minting_fee = total_amount - amount;

            let mint_destination_args = MintArgs::V1 {
                amount: minting_fee,
                authorization_data: None,
            };

            let seeds: &[&[u8]] = &[b"destiantion"];

            let (address, _) = Pubkey::find_program_address(&seeds, &ID);

            // check destination
            assert_keys_equal(destination.key, &address)?;

            let destination_ata_checked = &get_associated_token_address(&address, mint.key);

            // check destination ata
            assert_keys_equal(destination_ata_checked, destination_ata.key)?;

            MintCpiBuilder::new(token_metadata_program)
                .token(&destination_ata)
                .token_owner(Some(&destination))
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
                .mint_args(mint_destination_args.clone())
                .invoke_signed(&[seeds_signer])?;
        },
    };

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
        constraint = device_owner.key() == device.owner
    )]
    pub device_owner: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [ContractConfig::PREFIX_SEED],
        bump
    )]
    pub contract_config: Account<'info, ContractConfig>,

    #[account(mut)]
    /// CHECK:
    pub owner_ata: AccountInfo<'info>,

    /// CHECK:
    pub destination: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK:
    pub destination_ata: AccountInfo<'info>,

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
    pub mint: Signer<'info>,

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