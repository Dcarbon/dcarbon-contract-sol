use anchor_lang::prelude::*;
use mpl_token_metadata::instructions::{BurnCpiBuilder, MintCpiBuilder};
use mpl_token_metadata::types::{BurnArgs, MintArgs};
use crate::ID;

pub fn swap_sft(ctx: Context<SwapSft>, burn_data_vec: Vec<u8>, mint_data_vec: Vec<u8>) -> Result<()> {
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

    let burn_data = BurnArgs::try_from_slice(&burn_data_vec).unwrap();

    // check authority of mint

    // burn SFT
    BurnCpiBuilder::new(&token_metadata_program)
        .authority(&ctx.accounts.signer)
        .collection_metadata(None)
        .metadata(metadata_sft)
        .edition(None)
        .mint(&mint_sft.to_account_info())
        .token(&ctx.accounts.burn_ata)
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

    let mint_data = MintArgs::try_from_slice(&mint_data_vec).unwrap();

    // Mint token for user
    MintCpiBuilder::new(&token_metadata_program)
        .token(&ctx.accounts.to_ata)
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

    #[account(mut)]
    /// CHECK:
    pub burn_ata: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK:
    pub to_ata: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK:
    pub mint_sft: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK:
    pub mint_ft: AccountInfo<'info>,

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
    pub token_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK:
    pub sysvar_program: AccountInfo<'info>,

    /// CHECK:
    pub token_metadata_program: AccountInfo<'info>,

    /// CHECK:
    pub ata_program: AccountInfo<'info>,
}