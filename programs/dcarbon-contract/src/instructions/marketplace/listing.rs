use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{Mint, Token};
use spl_token::instruction::approve_checked;
use spl_token::solana_program::program::invoke;

use crate::state::{MARKETPLACE_PREFIX_SEED, TokenListingInfo};

#[derive(Debug)]
pub struct ListingArgs {
    pub amount: u64,
    pub price: u64,
    pub project_id: u16,
}

pub fn listing(ctx: Context<Listing>, listing_args: ListingArgs) -> Result<()> {
    let token_program = &ctx.accounts.token_program;
    let source_ata = &ctx.accounts.source_ata;
    let mint = &ctx.accounts.mint;
    let delegate = &ctx.accounts.marketplace_delegate;
    let signer = &ctx.accounts.signer;
    let token_listing_info = &mut ctx.accounts.token_listing_info;

    let approve_checked_ins = approve_checked(token_program.key, &source_ata.key(), &mint.key(), delegate.key, signer.key, &[], listing_args.amount, mint.decimals)?;

    invoke(&approve_checked_ins, &[token_program.clone()])?;

    token_listing_info.amount = listing_args.amount;
    token_listing_info.owner = signer.key();
    token_listing_info.price = listing_args.price;
    token_listing_info.mint = mint.key();
    token_listing_info.project_id = listing_args.project_id;

    Ok(())
}

#[derive(Accounts)]
pub struct Listing<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    /// CHECK:
    pub source_ata: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + TokenListingInfo::INIT_SPACE,
        seeds = [MARKETPLACE_PREFIX_SEED, mint.key().as_ref()],
        bump,
    )]
    pub token_listing_info: Account<'info, TokenListingInfo>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 0,
        seeds = [MARKETPLACE_PREFIX_SEED, b"delegate"],
        bump
    )]
    /// CHECK:
    pub marketplace_delegate: AccountInfo<'info>,

    /// CHECK:
    pub token_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}