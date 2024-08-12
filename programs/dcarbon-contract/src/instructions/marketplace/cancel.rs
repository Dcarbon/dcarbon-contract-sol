use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::state::TokenListingInfo;
use crate::utils::assert_keys_equal;

pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
    let signer = &ctx.accounts.signer;
    let token_listing_info = &ctx.accounts.token_listing_info;

    assert_keys_equal(signer.key, &token_listing_info.owner)?;

    msg!("cancel_info-{}-{}", signer.key, token_listing_info.owner);
    Ok(())
}

#[derive(Accounts)]
#[instruction(_nonce: u32)]
pub struct CancelListing<'info> {
    #[account(
        mut,
        constraint = signer.key() == token_listing_info.owner
    )]
    pub signer: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        close = signer
    )]
    pub token_listing_info: Box<Account<'info, TokenListingInfo>>,
}