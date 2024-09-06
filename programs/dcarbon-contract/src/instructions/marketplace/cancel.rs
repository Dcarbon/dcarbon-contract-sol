use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use spl_token::instruction::revoke;
use spl_token::solana_program::program::invoke;

use crate::state::TokenListingInfo;
use crate::utils::assert_keys_equal;

pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
    let signer = &ctx.accounts.signer;
    let token_listing_info = &ctx.accounts.token_listing_info;
    let token_program = &ctx.accounts.token_program;
    let source_ata = &ctx.accounts.source_ata;

    assert_keys_equal(signer.key, &token_listing_info.owner)?;

    let revoke_ins = revoke(
        &token_program.key(),
        &ctx.accounts.source_ata.key(),
        signer.key,
        &[],
    )?;

    invoke(
        &revoke_ins,
        &[
            token_program.to_account_info(),
            source_ata.clone(),
            signer.to_account_info(),
        ],
    )?;

    msg!("cancel_info-{}-{}", signer.key, token_listing_info.owner);

    Ok(())
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(
        mut,
        constraint = signer.key() == token_listing_info.owner
    )]
    pub signer: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [TokenListingInfo::PREFIX_SEED, signer.key().as_ref(), mint.key().as_ref()],
        bump,
        close = signer
    )]
    pub token_listing_info: Box<Account<'info, TokenListingInfo>>,

    pub token_program: Program<'info, Token>,

    #[account(mut)]
    /// CHECK:
    pub source_ata: AccountInfo<'info>,
}
