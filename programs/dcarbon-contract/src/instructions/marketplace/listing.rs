use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use spl_token::instruction::approve_checked;
use spl_token::solana_program::program::invoke;

use crate::error::DCarbonError;
use crate::state::{MARKETPLACE_PREFIX_SEED, MarketplaceCounter, TokenListingInfo};

#[derive(InitSpace, Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ListingArgs {
    pub amount: f64,
    pub price: f64,
    pub project_id: u16,
    pub nonce: u32,
    pub currency: Option<Pubkey>,
}

pub fn listing(ctx: Context<Listing>, listing_args: ListingArgs) -> Result<()> {
    let token_program = &ctx.accounts.token_program;
    let source_ata = &ctx.accounts.source_ata;
    let mint = &ctx.accounts.mint;
    let delegate = &ctx.accounts.marketplace_delegate;
    let signer = &ctx.accounts.signer;
    let token_listing_info = &mut ctx.accounts.token_listing_info;
    let marketplace_counter = &mut ctx.accounts.marketplace_counter;

    if marketplace_counter.nonce != listing_args.nonce {
        return Err(DCarbonError::InvalidNonce.into());
    }

    let approve_checked_ins = approve_checked(
        token_program.key,
        &source_ata.key(),
        &mint.key(),
        delegate.key,
        signer.key,
        &[],
        (listing_args.amount * 10f64.powf(mint.decimals as f64)) as u64,
        mint.decimals
    )?;

    invoke(
        &approve_checked_ins,
        &[token_program.clone(),
            source_ata.clone(),
            mint.to_account_info(),
            delegate.clone(),
            signer.to_account_info(),
        ],
    )?;

    token_listing_info.amount = listing_args.amount;
    token_listing_info.owner = signer.key();
    token_listing_info.price = listing_args.price;
    token_listing_info.mint = mint.key();
    token_listing_info.project_id = listing_args.project_id;
    token_listing_info.currency = listing_args.currency;

    marketplace_counter.nonce += 1;
    Ok(())
}

#[derive(Accounts)]
#[instruction(listing_args: ListingArgs)]
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
        seeds = [MARKETPLACE_PREFIX_SEED, mint.key().as_ref(), signer.key().as_ref(), & listing_args.nonce.to_le_bytes()],
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

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MarketplaceCounter::INIT_SPACE,
        seeds = [MARKETPLACE_PREFIX_SEED, MarketplaceCounter::PREFIX_SEED],
        bump
    )]
    pub marketplace_counter: Account<'info, MarketplaceCounter>,

    /// CHECK:
    pub token_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}