use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked;
use anchor_spl::token::Token;
use anchor_spl::{associated_token::AssociatedToken, metadata::Metadata};
use mpl_token_metadata::instructions::{CreateCpiBuilder, MintCpiBuilder};
use mpl_token_metadata::types::{CreateArgs, MintArgs};

use crate::*;
use crate::error::DCarbonError;
use crate::state::{Claim, ContractConfig, Device, DeviceLimit, DeviceStatus, Governance};
use crate::utils::assert_keys_equal;

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintSftArgs {
    project_id: u16,
    device_id: u16,
    nonce: u16,
    create_mint_data_vec: Vec<u8>,
    total_amount: f64,
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VerifyMessageArgs {
    eth_address: [u8; 20],
    msg: Vec<u8>,
    sig: [u8; 64],
    recovery_id: u8,
}

pub fn mint_sft<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, MintSft<'info>>,
    mint_sft_args: MintSftArgs,
    verify_message_args: VerifyMessageArgs,
) -> Result<()> {
    let mint = &ctx.accounts.mint;
    let signer = &ctx.accounts.signer;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;
    let metadata = &ctx.accounts.metadata;
    let authority = &ctx.accounts.authority;
    let device_status = &mut ctx.accounts.device_status;
    let contract_config = &ctx.accounts.contract_config;
    let token_metadassociated_token_program = &ctx.accounts.token_metadassociated_token_program;
    let governance = &mut ctx.accounts.governance;
    let owner_governance = &mut ctx.accounts.owner_governance;
    let device_owner = &ctx.accounts.device_owner;

    // check args
    mint_sft_args.validate(device_status.nonce)?;

    // check is active
    if !device_status.is_active {
        return Err(DCarbonError::DeviceIsNotActive.into());
    }

    // check time
    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;
    let time = 360; // 86400 = 1 day
    if current_timestamp < device_status.last_mint_time + time {
        return Err(DCarbonError::NotMintTime.into());
    }

    // check limit
    let list_remaining_accounts = &mut ctx.remaining_accounts.iter();
    let device = next_account_info(list_remaining_accounts)?;
    let device_data: Account<Device> = Account::try_from(device)?;

    // check token_owner, minter
    assert_keys_equal(signer.key, &device_data.minter)?;

    assert_keys_equal(device_owner.key, &device_data.owner)?;

    let mut amount = mint_sft_args.total_amount;
    if let Some(limit) = find_limit(&contract_config.minting_limits, device_data.device_type) {
        if amount > limit {
            amount = limit;
        }
    } else {
        println!("Device type {} not found", device_data.device_type);
    }

    // verify signature
    // Get what should be the Secp256k1Program instruction
    let ix: Instruction = load_instruction_at_checked(0, &ctx.accounts.sysvar_program.to_account_info())?;

    // Check that ix is what we expect to have been sent
    utils::verify_secp256k1_ix(&ix, &verify_message_args.eth_address, &verify_message_args.msg, &verify_message_args.sig, verify_message_args.recovery_id)?;

    let seeds: &[&[u8]] = &[b"authority"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    // create mint
    let create_data = CreateArgs::try_from_slice(&mint_sft_args.create_mint_data_vec).unwrap();

    CreateCpiBuilder::new(token_metadassociated_token_program)
        .metadata(metadata)
        .master_edition(None)
        .mint(&mint.to_account_info(), true)
        .authority(&authority.to_account_info())
        .payer(&signer.to_account_info())
        .update_authority(&authority.to_account_info(), true)
        .system_program(&system_program.to_account_info())
        .sysvar_instructions(&ctx.accounts.sysvar_program.to_account_info())
        .spl_token_program(Some(&token_program.to_account_info()))
        .create_args(create_data.clone())
        .invoke_signed(&[seeds_signer])?;


    let CreateArgs::V1 { decimals, .. } = create_data.clone();
    {
        match decimals {
            Some(decimals) => {
                let minting_fee = amount * contract_config.minting_fee;

                let minting_amount = amount - minting_fee;

                // mint for owner
                let mint_data = MintArgs::V1 {
                    amount: (minting_amount * 10f64.powf(decimals as f64)) as u64,
                    authorization_data: None,
                };

                MintCpiBuilder::new(token_metadassociated_token_program)
                    .token(&ctx.accounts.owner_ata)
                    .token_owner(Some(device_owner))
                    .metadata(metadata)
                    .master_edition(None)
                    .token_record(None)
                    .mint(&mint.to_account_info())
                    .authority(authority)
                    .delegate_record(None)
                    .payer(&signer.to_account_info())
                    .system_program(&system_program.to_account_info())
                    .sysvar_instructions(&ctx.accounts.sysvar_program.to_account_info())
                    .spl_token_program(token_program)
                    .spl_ata_program(&ctx.accounts.associated_token_program.to_account_info())
                    .authorization_rules(None)
                    .authorization_rules_program(None)
                    .mint_args(mint_data.clone())
                    .invoke_signed(&[seeds_signer])?;

                // increase fee amount
                let claim = &mut ctx.accounts.claim;
                claim.mint = mint.key();
                claim.project_id = mint_sft_args.project_id;

                let mut governance_amount = amount * contract_config.rate;

                // increase dCarbon
                if governance.amount > 0.0 {
                    
                    // check if governance_amount is higher than governance.amount
                    if governance_amount > governance.amount {
                        governance_amount = governance.amount
                    }
                    
                    governance.amount -= governance_amount;
                    owner_governance.amount += governance_amount;
                    owner_governance.owner = device_owner.key();
                    owner_governance.mint = governance.mint;
                    
                    // calculate total governance_amount
                    claim.amount += governance_amount;
                }

                // increase
                device_status.nonce += 1;
                device_status.last_mint_time = current_timestamp;

                // mint for vault
                let mint_data_vault = MintArgs::V1 {
                    amount: (minting_fee * 10f64.powf(decimals as f64)) as u64,
                    authorization_data: None,
                };

                MintCpiBuilder::new(token_metadassociated_token_program)
                    .token(&ctx.accounts.vault_ata)
                    .token_owner(Some(&ctx.accounts.vault))
                    .metadata(metadata)
                    .master_edition(None)
                    .token_record(None)
                    .mint(&mint.to_account_info())
                    .authority(authority)
                    .delegate_record(None)
                    .payer(&signer.to_account_info())
                    .system_program(&system_program.to_account_info())
                    .sysvar_instructions(&ctx.accounts.sysvar_program.to_account_info())
                    .spl_token_program(token_program)
                    .spl_ata_program(&ctx.accounts.associated_token_program.to_account_info())
                    .authorization_rules(None)
                    .authorization_rules_program(None)
                    .mint_args(mint_data_vault.clone())
                    .invoke_signed(&[seeds_signer])?;

                msg!("mintinfo_{}_{}_{}_{}_{}_{}", mint_sft_args.project_id, mint_sft_args.device_id, mint_sft_args.nonce, minting_amount, minting_fee, governance_amount);
            }
            None => {}
        }
    }

    // mint sft-fee for admin

    Ok(())
}

#[derive(Accounts)]
#[instruction(mint_sft_args: MintSftArgs)]
pub struct MintSft<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

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
        mut,
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
        constraint = vault.key() == contract_config.vault,
    )]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub vault_ata: AccountInfo<'info>,

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

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    /// CHECK: 
    pub sysvar_program: AccountInfo<'info>,
    pub token_metadassociated_token_program: Program<'info, Metadata>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

fn find_limit(device_limits: &Vec<DeviceLimit>, target_device_type: u16) -> Option<f64> {
    device_limits.iter()
        .find(|&device_limit| device_limit.device_type == target_device_type)
        .map(|device_limit| device_limit.limit)
}

impl MintSftArgs {
    pub fn validate(&self, nonce: u16) -> Result<()> {
        if self.project_id <= 0 {
            return Err(DCarbonError::InvalidProjectId.into());
        }

        if self.device_id <= 0 {
            return Err(DCarbonError::InvalidDeviceId.into());
        }

        if self.total_amount <= 0.0 {
            return Err(DCarbonError::InvalidNumber.into());
        }

        // check nonce, check valid
        if self.nonce != nonce + 1 {
            return Err(DCarbonError::InvalidNonce.into());
        }

        Ok(())
    }
}
