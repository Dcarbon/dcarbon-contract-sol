use anchor_lang::prelude::*;
use mpl_token_metadata::instructions::CreateCpiBuilder;
use mpl_token_metadata::types::CreateArgs;
use crate::ID;

pub fn create_mint(ctx: Context<CreateMint>, create_data_vec: Vec<u8>) -> Result<()> {
    let creator = &ctx.accounts.creator;
    let mint = &ctx.accounts.mint;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;
    let metadata = &ctx.accounts.metadata;
    let authority = &ctx.accounts.authority;
    let create_data = CreateArgs::try_from_slice(&create_data_vec).unwrap();

    let seeds: &[&[u8]] = &[b"authority"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    CreateCpiBuilder::new(&ctx.accounts.token_metadata_program)
        .metadata(metadata)
        .master_edition(None)
        .mint(&mint.to_account_info(), true)
        .authority(&authority.to_account_info())
        .payer(&creator.to_account_info())
        .update_authority(&authority.to_account_info(), true)
        .system_program(&system_program.to_account_info())
        .sysvar_instructions(&ctx.accounts.sysvar_program)
        .spl_token_program(Some(&token_program.to_account_info()))
        .create_args(create_data)
        .invoke_signed(&[seeds_signer])?;

    Ok(())
}

#[derive(Accounts)]
pub struct CreateMint<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

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