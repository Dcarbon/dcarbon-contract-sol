use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::sysvar::instructions::{ID as IX_ID, load_instruction_at_checked};
use anchor_spl::associated_token::get_associated_token_address;
use mpl_token_metadata::instructions::{CreateCpiBuilder, MintCpiBuilder};
use mpl_token_metadata::types::{CreateArgs, MintArgs};

use crate::*;
use crate::error::DCarbonError;
use crate::state::{Claim, ContractConfig, Device, DeviceStatus, Governance};
use crate::utils::assert_keys_equal;

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintSftArgs {
    project_id: u16,
    device_id: u16,
    nonce: u16,
    create_mint_data_vec: Vec<u8>,
    total_amount: u64,
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VerifyMessageArgs {
    eth_address: [u8; 20],
    msg: Vec<u8>,
    sig: [u8; 64],
    recovery_id: u8,
}

pub fn mint_sft(ctx: Context<MintSft>, mint_sft_args: MintSftArgs, verify_message_args: VerifyMessageArgs) -> Result<()> {
    let mint = &ctx.accounts.mint;
    let signer = &ctx.accounts.signer;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;
    let metadata = &ctx.accounts.metadata;
    let authority = &ctx.accounts.authority;
    let device_status = &mut ctx.accounts.device_status;
    let contract_config = &ctx.accounts.contract_config;
    let token_metadata_program = &ctx.accounts.token_metadata_program;
    let governance = &mut ctx.accounts.governance;
    let owner_governance = &mut ctx.accounts.owner_governance;

    // check is active
    if !device_status.is_active {
        return Err(DCarbonError::DeviceIsNotActive.into());
    }

    // check nonce, check valid
    if mint_sft_args.nonce != device_status.nonce + 1 {
        return Err(DCarbonError::InvalidNonce.into());
    }

    // check time
    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;
    let time = 360; // 86400 = 1 day
    if current_timestamp < device_status.last_mint_time + time {
        return Err(DCarbonError::NotMintTime.into());
    }

    // check limit, after

    // verify signature
    // Get what should be the Secp256k1Program instruction
    let ix: Instruction = load_instruction_at_checked(0, &ctx.accounts.sysvar_program)?;

    // Check that ix is what we expect to have been sent
    utils::verify_secp256k1_ix(&ix, &verify_message_args.eth_address, &verify_message_args.msg, &verify_message_args.sig, verify_message_args.recovery_id)?;

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

    let minting_fee = (mint_sft_args.total_amount as f64 * contract_config.minting_fee) as u64 / 10;

    let minting_amount = mint_sft_args.total_amount - minting_fee;

    // mint for owner
    let mint_data = MintArgs::V1 {
        amount: minting_amount,
        authorization_data: None,
    };

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

    // increase fee amount
    let claim = &mut ctx.accounts.claim;
    claim.mint = mint.key();

    // hard code
    claim.amount += minting_fee;
    claim.project_id = mint_sft_args.project_id;

    let governance_amount = (mint_sft_args.total_amount as f64 * contract_config.rate) as u64 / 10;

    // increase dCarbon
    if governance.amount > 0 && governance.amount >= governance_amount {
        governance.amount -= governance_amount;
        owner_governance.amount += governance_amount;
    }

    msg!("mintinfo_{}_{}_{}_{}_{}_{}", mint_sft_args.project_id, mint_sft_args.device_id, device_status.nonce, minting_amount, minting_fee, governance_amount);


    // increase
    device_status.nonce += 1;
    device_status.last_mint_time = current_timestamp;

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
        init_if_needed,
        space = 8 + Governance::INIT_SPACE,
        payer = signer,
        seeds = [Governance::PREFIX_SEED, device_owner.key().as_ref()],
        bump
    )]
    pub owner_governance: Box<Account<'info, Governance>>,

    #[account(
        seeds = [Governance::PREFIX_SEED],
        bump,
        owner = ID
    )]
    pub governance: Account<'info, Governance>,

    #[account(
        seeds = [ContractConfig::PREFIX_SEED],
        bump,
        owner = ID,
    )]
    /// CHECK:
    pub contract_config: Account<'info, ContractConfig>,

    #[account(
        init,
        payer = signer,
        space = 8 + Claim::INIT_SPACE,
        seeds = [Claim::PREFIX_SEED, mint.key().as_ref()],
        bump
    )]
    pub claim: Box<Account<'info, Claim>>,

    #[account(mut)]
    /// CHECK:
    pub owner_ata: AccountInfo<'info>,

    #[account(
        seeds = [Device::PREFIX_SEED, & mint_sft_args.project_id.to_le_bytes(), & mint_sft_args.device_id.to_le_bytes()],
        bump,
        owner = ID,
    )]
    pub device: Account<'info, Device>,

    #[account(
        mut,
        seeds = [DeviceStatus::PREFIX_SEED, & mint_sft_args.device_id.to_le_bytes()],
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
    #[account(mut)]
    pub metadata: AccountInfo<'info>,

    /// CHECK:
    pub token_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK:
    #[account(address = IX_ID)]
    pub sysvar_program: AccountInfo<'info>,

    /// CHECK:
    pub token_metadata_program: AccountInfo<'info>,

    /// CHECK:
    pub ata_program: AccountInfo<'info>,
}