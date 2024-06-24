use anchor_lang::prelude::*;
use mpl_token_metadata::instructions::CreateCpiBuilder;
use mpl_token_metadata::types::CreateArgs;

use crate::state::Project;
use crate::*;

pub fn register_project(ctx: Context<RegisterProject>, project_args: Project, create_data_vec: Vec<u8>) -> Result<()> {
    let creator = &ctx.accounts.creator;
    let project = &mut ctx.accounts.project;
    let mint = &ctx.accounts.mint;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;
    let metadata = &ctx.accounts.metadata;
    let authority = &ctx.accounts.authority;

    let seeds: &[&[u8]] = &[b"authority"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    let create_data = CreateArgs::try_from_slice(&create_data_vec).unwrap();

    // assign project data
    Project::assign(project, project_args)?;

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
#[instruction(project_args: Project)]
pub struct RegisterProject<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
    init,
    payer = creator,
    space = 8 + Project::INIT_SPACE,
    seeds = [Project::PREFIX_SEED, project_args.id.as_bytes()],
    bump
    )]
    pub project: Account<'info, Project>,

    #[account(
        init_if_needed,
        payer = creator,
        space = 0,
        seeds = [b"authority"],
        bump
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
