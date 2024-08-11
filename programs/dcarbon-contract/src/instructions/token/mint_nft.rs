use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3,
        CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata,
        set_and_verify_sized_collection_item, SetAndVerifySizedCollectionItem, sign_metadata, SignMetadata,
    },
    token::{Mint, mint_to, MintTo, Token, TokenAccount},
};
use mpl_token_metadata::types::DataV2;

use crate::ID;
use crate::instructions::BurningRecord;

pub fn mint_nft(
    ctx: Context<MintNft>,
    uri: String,
    name: String,
    symbol: String,
) -> Result<()> {
    let seeds: &[&[u8]] = &[b"update_authority"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.nft_mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.collection_mint.to_account_info(),
            },
            &[seeds_signer],
        ),
        1,
    )?;

    // create metadata account for nft in collection
    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.nft_mint.to_account_info(),
                mint_authority: ctx.accounts.collection_mint.to_account_info(),
                update_authority: ctx.accounts.collection_mint.to_account_info(),
                payer: ctx.accounts.signer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &[seeds_signer],
        ),
        DataV2 {
            name,
            symbol,
            uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        true,
        true,
        None,
    )?;

    // create master edition account for nft in collection
    create_master_edition_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMasterEditionV3 {
                payer: ctx.accounts.signer.to_account_info(),
                mint: ctx.accounts.nft_mint.to_account_info(),
                edition: ctx.accounts.master_edition.to_account_info(),
                mint_authority: ctx.accounts.collection_mint.to_account_info(),
                update_authority: ctx.accounts.collection_mint.to_account_info(),
                metadata: ctx.accounts.metadata_account.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &[seeds_signer],
        ),
        Some(0),
    )?;

    // verify nft as part of collection
    set_and_verify_sized_collection_item(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            SetAndVerifySizedCollectionItem {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                collection_authority: ctx.accounts.collection_mint.to_account_info(),
                payer: ctx.accounts.signer.to_account_info(),
                update_authority: ctx.accounts.collection_mint.to_account_info(),
                collection_mint: ctx.accounts.collection_mint.to_account_info(),
                collection_metadata: ctx.accounts.collection_metadata_account.to_account_info(),
                collection_master_edition: ctx
                    .accounts
                    .collection_master_edition
                    .to_account_info(),
            },
            &[seeds_signer],
        ),
        None,
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct MintNft<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [BurningRecord::PREFIX_SEED, signer.key().as_ref()],
        bump,
        owner = ID
    )]
    pub burning_record: Account<'info, BurningRecord>,

    #[account(
        mut,
        seeds = [SEED.as_bytes()],
        bump,
    )]
    pub collection_mint: Account<'info, Mint>,

    /// CHECK:
    #[account(
        mut,
        address = find_metadata_account(& collection_mint.key()).0
    )]
    pub collection_metadata_account: UncheckedAccount<'info>,

    /// CHECK:
    #[account(
        mut,
        address = find_master_edition_account(& collection_mint.key()).0
    )]
    pub collection_master_edition: UncheckedAccount<'info>,

    #[account(
        init,
        payer = signer,
        mint::decimals = 0,
        mint::authority = collection_mint,
        mint::freeze_authority = collection_mint
    )]
    pub nft_mint: Account<'info, Mint>,

    /// CHECK:
    #[account(
        mut,
        address = find_metadata_account(& nft_mint.key()).0
    )]
    pub metadata_account: UncheckedAccount<'info>,

    /// CHECK:
    #[account(
        mut,
        address = find_master_edition_account(& nft_mint.key()).0
    )]
    pub master_edition: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = nft_mint,
        associated_token::authority = signer
    )]
    pub token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub rent: Sysvar<'info, Rent>,
}