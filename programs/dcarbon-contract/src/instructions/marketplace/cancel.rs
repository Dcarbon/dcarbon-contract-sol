use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::state::{MARKETPLACE_PREFIX_SEED, TokenListingInfo};

pub fn cancel_listing(_ctx: Context<CancelListing>, _nonce: u32) -> Result<()> {
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
        seeds = [MARKETPLACE_PREFIX_SEED, mint.key().as_ref(), signer.key().as_ref(), & _nonce.to_le_bytes()],
        bump,
        close = signer
    )]
    pub token_listing_info: Box<Account<'info, TokenListingInfo>>,
}