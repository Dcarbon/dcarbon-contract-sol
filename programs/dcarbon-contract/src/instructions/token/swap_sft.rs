use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::Metadata;
use anchor_spl::token::{Mint, Token, TokenAccount};
use mpl_token_metadata::instructions::{BurnCpiBuilder, MintCpiBuilder};
use mpl_token_metadata::types::{BurnArgs, MintArgs};
use crate::state::ContractConfig;
use crate::ID;

pub fn swap_sft(ctx: Context<SwapSft>, burn_amount: f64) -> Result<()> {
    let mint_sft = &ctx.accounts.mint_sft;
    let mint_ft = &ctx.accounts.mint_ft;
    let signer = &ctx.accounts.signer;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;
    let metadata_sft = &ctx.accounts.metadata_sft;
    let metadata_ft = &ctx.accounts.metadata_ft;
    let authority = &ctx.accounts.authority;
    let token_metadata_program = &ctx.accounts.token_metadata_program;

    let seeds: &[&[u8]] = &[b"authority"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    let burn_data = BurnArgs::V1 { amount: (burn_amount * 10f64.powf(mint_sft.decimals as f64)).round() as u64 };

    // check authority of mint

    // burn SFT
    BurnCpiBuilder::new(&token_metadata_program)
        .authority(&ctx.accounts.signer)
        .collection_metadata(None)
        .metadata(metadata_sft)
        .edition(None)
        .mint(&mint_sft.to_account_info())
        .token(&ctx.accounts.burn_ata.to_account_info())
        .master_edition(None)
        .master_edition_mint(None)
        .master_edition_token(None)
        .edition_marker(None)
        .token_record(None)
        .system_program(&system_program.to_account_info())
        .sysvar_instructions(&ctx.accounts.sysvar_program)
        .spl_token_program(&token_program.to_account_info())
        .burn_args(burn_data)
        .invoke_signed(&[seeds_signer])?;

    let mint_data = MintArgs::V1 { amount: (burn_amount * 10f64.powf(mint_ft.decimals as f64)).round() as u64, authorization_data: None };

    // Mint token for user
    MintCpiBuilder::new(&token_metadata_program)
        .token(&ctx.accounts.to_ata.to_account_info())
        .token_owner(Some(&ctx.accounts.signer))
        .metadata(metadata_ft)
        .master_edition(None)
        .token_record(None)
        .mint(&mint_ft.to_account_info())
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
pub struct SwapSft<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        seeds = [ContractConfig::PREFIX_SEED],
        bump,
        owner = ID, 
    )]
    pub contract_config: Account<'info, ContractConfig>,

    #[account(
        mut,
        constraint = burn_ata.mint == mint_sft.key(),
        constraint = burn_ata.owner == signer.key()
    )]
    /// CHECK:
    pub burn_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = to_ata.mint == mint_ft.key(),
        constraint = to_ata.owner == signer.key()
    )]
    /// CHECK:
    pub to_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = mint_sft.mint_authority.unwrap() == authority.key(),
    )]
    /// CHECK:
    pub mint_sft: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = mint_ft.mint_authority.unwrap() == authority.key(),
        constraint = mint_ft.key() == contract_config.mint,
    )]
    /// CHECK:
    pub mint_ft: Box<Account<'info, Mint>>,

    /// CHECK:
    #[account(mut)]
    pub metadata_sft: AccountInfo<'info>,

    /// CHECK:
    #[account(mut)]
    pub metadata_ft: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"authority"],
        bump,
        owner = ID
    )]
    /// CHECK:
    pub authority: AccountInfo<'info>,

    /// CHECK:
    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,

    /// CHECK:
    pub sysvar_program: AccountInfo<'info>,

    /// CHECK:
    pub token_metadata_program: Program<'info, Metadata>,

    /// CHECK:
    pub ata_program: Program<'info, AssociatedToken>,
}