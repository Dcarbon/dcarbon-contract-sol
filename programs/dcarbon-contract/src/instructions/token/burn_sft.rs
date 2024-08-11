use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use mpl_token_metadata::instructions::BurnCpiBuilder;
use mpl_token_metadata::types::BurnArgs;

use crate::ID;

pub fn burn_sft(ctx: Context<BurnSft>, amount: f64) -> Result<()> {
    let mint_sft = &ctx.accounts.mint_sft;
    let signer = &ctx.accounts.signer;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;
    let metadata_sft = &ctx.accounts.metadata_sft;
    let token_metadata_program = &ctx.accounts.token_metadata_program;
    let burn_ata = &ctx.accounts.burn_ata;
    let burning_record = &mut ctx.accounts.burning_record;

    let burn_data = BurnArgs::V1 {
        amount: (amount * 10f64.powf(mint_sft.decimals as f64)) as u64
    };

    let seeds: &[&[u8]] = &[b"authority"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    // burn SFT
    BurnCpiBuilder::new(&token_metadata_program)
        .authority(signer)
        .collection_metadata(None)
        .metadata(metadata_sft)
        .edition(None)
        .mint(&mint_sft.to_account_info())
        .token(burn_ata)
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

    burning_record.total_amount += amount;

    Ok(())
}

#[derive(Accounts)]
pub struct BurnSft<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub mint_sft: Account<'info, Mint>,

    #[account(mut)]
    /// CHECK:
    pub burn_ata: AccountInfo<'info>,

    /// CHECK:
    #[account(mut)]
    pub metadata_sft: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + BurningRecord::INIT_SPACE,
        seeds = [BurningRecord::PREFIX_SEED, signer.key().as_ref()],
        bump
    )]
    pub burning_record: Account<'info, BurningRecord>,

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

}

#[account]
#[derive(Debug, InitSpace)]
pub struct BurningRecord {
    pub total_amount: f64,
}

impl BurningRecord {
    pub const PREFIX_SEED: &'static [u8] = b"burning_record";
}