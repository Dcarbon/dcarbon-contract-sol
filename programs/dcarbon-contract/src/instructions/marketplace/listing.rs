use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use spl_token::instruction::approve_checked;
use spl_token::solana_program::program::invoke;

use crate::ID;
use crate::state::{MARKETPLACE_PREFIX_SEED, MarketplaceCounter, TokenListingInfo};

#[derive(InitSpace, Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ListingArgs {
    pub amount: f64,
    pub price: f64,
    pub project_id: u16,
    pub currency: Option<Pubkey>,
    pub random_id: u16,
}



pub fn listing<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, Listing<'info>>,
    listing_args: ListingArgs,
) -> Result<()> {
    let token_program = &ctx.accounts.token_program;
    let source_ata = &ctx.accounts.source_ata;
    let mint = &ctx.accounts.mint;
    let delegate = &ctx.accounts.marketplace_delegate;
    let signer = &ctx.accounts.signer;
    let system_program = &ctx.accounts.system_program;
    let marketplace_counter = &mut ctx.accounts.marketplace_counter;

    let list_remaining_accounts = &mut ctx.remaining_accounts.iter();
    let token_listing_info = next_account_info(list_remaining_accounts)?;

    let approve_checked_ins = approve_checked(
        token_program.key,
        &source_ata.key(),
        &mint.key(),
        delegate.key,
        signer.key,
        &[],
        (listing_args.amount * 10f64.powf(mint.decimals as f64)) as u64,
        mint.decimals,
    )?;

    invoke(
        &approve_checked_ins,
        &[token_program.clone(),
            source_ata.clone(),
            mint.to_account_info(),
            delegate.to_account_info(),
            signer.to_account_info(),
        ],
    )?;

    // assign token listing info
    TokenListingInfo::assign(
        token_listing_info,
        mint.to_account_info(),
        signer.to_account_info(),
        marketplace_counter.nonce,
        system_program.to_account_info(),
        listing_args.clone(),
    )?;

    marketplace_counter.nonce += 1;

    msg!("Nonce: {}", marketplace_counter.nonce);
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
        seeds = [MARKETPLACE_PREFIX_SEED, b"delegate"],
        bump,
        owner = ID
    )]
    /// CHECK:
    pub marketplace_delegate: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [MARKETPLACE_PREFIX_SEED, MarketplaceCounter::PREFIX_SEED],
        bump,
        owner = ID
    )]
    pub marketplace_counter: Account<'info, MarketplaceCounter>,

    /// CHECK:
    pub token_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}