use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use anchor_spl::token::Mint;
use spl_token::instruction::transfer_checked;
use spl_token::solana_program::native_token::LAMPORTS_PER_SOL;
use spl_token::solana_program::program::{invoke, invoke_signed};

use crate::error::DCarbonError;
use crate::state::{TokenListingInfo, MARKETPLACE_PREFIX_SEED};
use crate::utils::assert_keys_equal;
use crate::ID;

pub fn buy<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, Buy<'info>>,
    amount: f64,
) -> Result<()> {
    let signer = &ctx.accounts.signer;
    let token_listing_info = &mut ctx.accounts.token_listing_info;
    let delegate = &ctx.accounts.marketplace_delegate;
    let token_program = &ctx.accounts.token_program;
    let source_ata = &ctx.accounts.source_ata;
    let to_ata = &ctx.accounts.to_ata;
    let mint = &ctx.accounts.mint;
    let token_owner = &ctx.accounts.token_owner;
    let system_program = &ctx.accounts.system_program;

    // check have enough amount
    if token_listing_info.remaining < amount {
        return Err(DCarbonError::NotEnoughAmount.into());
    }

    let seeds: &[&[u8]] = &[MARKETPLACE_PREFIX_SEED, b"delegate"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    let fee_amount = amount * token_listing_info.price / token_listing_info.amount;

    match token_listing_info.currency {
        Some(token_address) => {
            let list_remaining_accounts = &mut ctx.remaining_accounts.iter();
            let token_program = next_account_info(list_remaining_accounts)?;
            let mint = next_account_info(list_remaining_accounts)?;
            let source = next_account_info(list_remaining_accounts)?;
            let destination = next_account_info(list_remaining_accounts)?;

            let mint_data: Account<Mint> = Account::try_from(mint)?;

            // validate mint key
            assert_keys_equal(&mint.key(), &token_address)?;

            // validate source key
            let source_key = get_associated_token_address_with_program_id(
                &signer.key,
                &mint.key,
                &token_program.key,
            );
            assert_keys_equal(&source.key(), &source_key)?;

            // validate to destination key
            let destination_key = get_associated_token_address_with_program_id(
                &token_listing_info.owner,
                &mint.key,
                &token_program.key,
            );
            assert_keys_equal(&destination.key(), &destination_key)?;

            invoke_signed(
                &transfer_checked(
                    token_program.key,
                    &source.key(),
                    &mint.key(),
                    &destination.key(),
                    signer.key,
                    &[],
                    (fee_amount * 10f64.powf(mint_data.decimals as f64)).round() as u64,
                    mint_data.decimals,
                )
                .unwrap(),
                &[
                    token_program.to_account_info(),
                    source.to_account_info(),
                    mint.to_account_info(),
                    destination.to_account_info(),
                    signer.to_account_info(),
                ],
                &[seeds_signer],
            )?;
        }
        None => {
            invoke(
                &system_instruction::transfer(
                    &signer.key(),
                    &token_owner.key(),
                    (fee_amount * LAMPORTS_PER_SOL as f64) as u64,
                ),
                &[
                    signer.to_account_info().clone(),
                    token_owner.to_account_info(),
                    system_program.to_account_info(),
                ],
            )?;
        }
    }

    // transfer token
    let transfer_ins = transfer_checked(
        token_program.key,
        source_ata.key,
        &mint.key(),
        to_ata.key,
        delegate.key,
        &[],
        (amount * 10f64.powf(mint.decimals as f64)).round() as u64,
        mint.decimals,
    )?;

    invoke_signed(
        &transfer_ins,
        &[
            token_program.clone(),
            source_ata.clone(),
            mint.to_account_info(),
            to_ata.clone(),
            delegate.clone(),
        ],
        &[seeds_signer],
    )?;

    // decrease token_listing_info
    token_listing_info.remaining -= amount;

    msg!(
        "buy_info-{}-{}-{}-{:?}-{}",
        token_owner.key,
        signer.key,
        amount,
        token_listing_info.currency,
        fee_amount
    );

    Ok(())
}

#[derive(Accounts)]
pub struct Buy<'info> {
    pub signer: Signer<'info>,

    #[account(
        constraint = mint.key() == token_listing_info.mint
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    /// CHECK:
    pub source_ata: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK:
    pub to_ata: AccountInfo<'info>,

    #[account(
        mut,
        owner = ID
    )]
    pub token_listing_info: Account<'info, TokenListingInfo>,

    #[account(
        mut,
        constraint = token_owner.key() == token_listing_info.owner
    )]
    /// CHECK:
    pub token_owner: AccountInfo<'info>,

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
