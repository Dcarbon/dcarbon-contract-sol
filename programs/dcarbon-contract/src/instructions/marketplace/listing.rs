use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use spl_token::instruction::approve_checked;
use spl_token::solana_program::program::invoke;

use crate::ID;
use crate::state::{MARKETPLACE_PREFIX_SEED, TokenListingInfo};
use crate::utils::cmp_pubkeys;

#[derive(InitSpace, Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ListingArgs {
    pub price: f64,
    pub project_id: u16,
    pub currency: Option<Pubkey>,
    pub amount: f64,
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
    let token_listing_info = &mut ctx.accounts.token_listing_info;
    let system_program = &ctx.accounts.system_program;

    let mut delegate_amount = listing_args.amount;

    if !cmp_pubkeys(&token_listing_info.owner, system_program.key) {
        delegate_amount += token_listing_info.remaining;
        token_listing_info.update(listing_args)?;
    } else {
        token_listing_info.assign(listing_args, signer.key(), mint.key())?;
    }

    let approve_checked_ins = approve_checked(
        token_program.key,
        &source_ata.key(),
        &mint.key(),
        delegate.key,
        signer.key,
        &[],
        (delegate_amount * 10f64.powf(mint.decimals as f64)).round() as u64,
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
        seeds = [TokenListingInfo::PREFIX_SEED, signer.key().as_ref(), mint.key().as_ref()],
        bump
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

    pub system_program: Program<'info, System>,
}