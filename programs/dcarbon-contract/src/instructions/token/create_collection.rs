use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::{create_master_edition_v3, create_metadata_accounts_v3, CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata, sign_metadata, SignMetadata};
use anchor_spl::token::{Mint, mint_to, MintTo, Token, TokenAccount};
use mpl_token_metadata::types::{CollectionDetails, Creator};
use mpl_token_metadata::types::DataV2;

use crate::ID;
use crate::state::Master;

#[constant]
pub const SEED: &str = "Collection";

pub fn create_collection(
    ctx: Context<CreateCollection>,
    uri: String,
    name: String,
    symbol: String,
) -> Result<()> {
    let seeds: &[&[u8]] = &[SEED.as_ref()];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    // mint collection nft
    mint_to(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.collection_mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.collection_mint.to_account_info(),
        },
        &[seeds_signer],
    ), 1)?;

    // create metadata account for collection nft
    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.collection_mint.to_account_info(),
                mint_authority: ctx.accounts.collection_mint.to_account_info(), // use pda mint address as mint authority
                update_authority: ctx.accounts.collection_mint.to_account_info(), // use pda mint as update authority
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
            creators: Some(vec![Creator {
                address: ctx.accounts.signer.key(),
                verified: false,
                share: 100,
            }]),
            collection: None,
            uses: None,
        },
        true,
        true,
        Some(CollectionDetails::V1 { size: 0 }), // set as collection nft
    )?;

    // create master edition account for collection nft
    create_master_edition_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMasterEditionV3 {
                payer: ctx.accounts.signer.to_account_info(),
                mint: ctx.accounts.collection_mint.to_account_info(),
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

    // verify creator on metadata account
    sign_metadata(CpiContext::new(
        ctx.accounts.token_metadata_program.to_account_info(),
        SignMetadata {
            creator: ctx.accounts.signer.to_account_info(),
            metadata: ctx.accounts.metadata_account.to_account_info(),
        },
    ))?;

    Ok(())
}

#[derive(Accounts)]
pub struct CreateCollection<'info> {
    #[account(
        mut,
        constraint = signer.key() == master_pda.master_key
    )]
    pub signer: Signer<'info>,

    #[account(
        seeds = [b"master"],
        bump,
        owner = ID,
    )]
    pub master_pda: Account<'info, Master>,

    #[account(
        init_if_needed,
        seeds = [SEED.as_bytes()],
        bump,
        payer = signer,
        mint::decimals = 0,
        mint::authority = collection_mint,
        mint::freeze_authority = collection_mint
    )]
    pub collection_mint: Account<'info, Mint>,

    /// CHECK:
    #[account(mut)]
    pub metadata_account: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = collection_mint,
        associated_token::authority = signer
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// CHECK:
    #[account(mut)]
    pub master_edition: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub rent: Sysvar<'info, Rent>,
}
