use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use spl_token::instruction::transfer_checked;
use spl_token::solana_program::program::invoke_signed;

use crate::ID;
use crate::state::{MARKETPLACE_PREFIX_SEED, TokenListingInfo};

pub fn buy(ctx: Context<Buy>, amount: u64) -> Result<()> {
    let token_listing_info = &mut ctx.accounts.token_listing_info;
    let delegate = &ctx.accounts.marketplace_delegate;
    let token_program = &ctx.accounts.token_program;
    let source_ata = &ctx.accounts.source_ata;
    let to_ata = &ctx.accounts.to_ata;
    let mint = &ctx.accounts.mint;

    let seeds: &[&[u8]] = &[MARKETPLACE_PREFIX_SEED, b"delegate"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    // transfer token
    let transfer_ins = transfer_checked(token_program.key, source_ata.key, &mint.key(), to_ata.key, delegate.key, &[], amount, mint.decimals)?;

    invoke_signed(
        &transfer_ins,
        &[],
        &[seeds_signer],
    )?;

    //
    token_listing_info.amount -= amount;


    Ok(())
}

#[derive(Accounts)]
pub struct Buy<'info> {
    pub signer: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    /// CHECK:
    pub source_ata: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK:
    pub to_ata: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [MARKETPLACE_PREFIX_SEED, mint.key().as_ref()],
        bump,
        owner = ID
    )]
    pub token_listing_info: Account<'info, TokenListingInfo>,

    #[account(
        seeds = [MARKETPLACE_PREFIX_SEED, b"delegate"],
        bump,
        owner = ID
    )]
    /// CHECK:
    pub marketplace_delegate: AccountInfo<'info>,

    /// CHECK:
    pub token_program: AccountInfo<'info>,
}