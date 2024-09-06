use anchor_lang::prelude::*;
use mpl_token_metadata::instructions::{CreateCpiBuilder, MintCpiBuilder};
use mpl_token_metadata::types::{CreateArgs, MintArgs};
use spl_token::instruction::{set_authority, AuthorityType};
use spl_token::solana_program::program::invoke_signed;

use crate::state::Master;
use crate::ID;

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateFtArgs {
    total_supply: Option<u64>,
    disable_mint: bool,
    disable_freeze: bool,
    data_vec: Vec<u8>,
}

pub fn create_ft<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, CreateFt<'info>>,
    create_ft_args: CreateFtArgs,
) -> Result<()> {
    let signer = &ctx.accounts.signer;
    let mint = &ctx.accounts.mint;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;
    let metadata = &ctx.accounts.metadata;
    let authority = &ctx.accounts.authority;
    let create_data = CreateArgs::try_from_slice(&create_ft_args.data_vec).unwrap();
    let token_metadata_program = &ctx.accounts.token_metadata_program;

    let seeds: &[&[u8]] = &[b"authority"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

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

    // check supply
    match create_ft_args.total_supply {
        None => {}
        Some(supply) => {
            if supply > 0u64 {
                let mint_data = MintArgs::V1 {
                    amount: supply,
                    authorization_data: None,
                };

                let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();

                let to_ata = next_account_info(remaining_accounts_iter).unwrap();
                let ata_program = next_account_info(remaining_accounts_iter).unwrap();

                MintCpiBuilder::new(&ctx.accounts.token_metadata_program)
                    .token(to_ata)
                    .token_owner(Some(authority))
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
                    .spl_ata_program(ata_program)
                    .authorization_rules(None)
                    .authorization_rules_program(None)
                    .mint_args(mint_data)
                    .invoke_signed(&[seeds_signer])?;
            }
        }
    }

    // check if disable mint auth
    if create_ft_args.disable_mint {
        invoke_signed(
            &set_authority(
                &token_program.key(),
                &mint.key(),
                None,
                AuthorityType::MintTokens,
                &authority.key(),
                &[],
            )?,
            &[
                mint.to_account_info(),
                token_program.to_account_info(),
                authority.to_account_info(),
            ],
            &[seeds_signer],
        )?;
    }

    // check if disable freeze auth
    if create_ft_args.disable_freeze {
        invoke_signed(
            &set_authority(
                &token_program.key(),
                &mint.key(),
                None,
                AuthorityType::FreezeAccount,
                &authority.key(),
                &[],
            )?,
            &[
                mint.to_account_info(),
                token_program.to_account_info(),
                authority.to_account_info(),
            ],
            &[seeds_signer],
        )?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct CreateFt<'info> {
    #[account(
        mut,
        constraint = signer.key() == master_pda.master_key
    )]
    pub signer: Signer<'info>,

    #[account(
        seeds = [Master::PREFIX_SEED],
        bump,
        owner = ID,
    )]
    pub master_pda: Account<'info, Master>,

    #[account(
        init_if_needed,
        space = 0,
        payer = signer,
        seeds = [b"authority"],
        bump,
    )]
    /// CHECK:
    pub authority: AccountInfo<'info>,

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
