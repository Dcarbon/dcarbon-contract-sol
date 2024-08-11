use anchor_lang::prelude::*;

use crate::ID;
use crate::instructions::ListingArgs;
use crate::state::BpfWriter;
use crate::utils::{assert_keys_equal, create_account};

#[account]
#[derive(Debug, InitSpace)]
pub struct TokenListingInfo {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: f64,
    pub price: f64, // LAMPORT
    pub project_id: u16,
    pub nonce: u32,
    pub currency: Option<Pubkey>,
    pub remaining: f64,
}

impl TokenListingInfo {
    fn from<'info>(x: &'info AccountInfo<'info>) -> Account<'info, Self> {
        Account::try_from_unchecked(x).unwrap()
    }

    pub fn serialize(&self, info: AccountInfo) -> Result<()> {
        let dst: &mut [u8] = &mut info.try_borrow_mut_data().unwrap();
        let mut writer: BpfWriter<&mut [u8]> = BpfWriter::new(dst);
        TokenListingInfo::try_serialize(self, &mut writer)
    }

    pub fn assign<'info>(
        token_listing_info_account: &'info AccountInfo<'info>,
        mint: AccountInfo<'info>,
        signer: AccountInfo<'info>,
        nonce: u32,
        system_program: AccountInfo<'info>,
        listing_args: ListingArgs,

    ) -> Result<()> {
        let seeds: &[&[u8]] = &[
            MARKETPLACE_PREFIX_SEED,
            mint.key.as_ref(),
            signer.key.as_ref(),
            &nonce.to_le_bytes(),
        ];

        let (public_key, bump) = Pubkey::find_program_address(&seeds, &ID);

        assert_keys_equal(&public_key, token_listing_info_account.key)?;

        create_account(
            system_program,
            signer.to_account_info(),
            token_listing_info_account.clone(),
            seeds,
            bump,
            (8 + TokenListingInfo::INIT_SPACE) as u64,
            &ID,
        )?;

        let mut token_listing_info = TokenListingInfo::from(&token_listing_info_account);

        token_listing_info.owner = signer.key();
        token_listing_info.mint = mint.key();
        token_listing_info.amount = listing_args.amount;
        token_listing_info.price = listing_args.price;
        token_listing_info.nonce = nonce;
        token_listing_info.project_id = listing_args.project_id;
        token_listing_info.currency = listing_args.currency;
        token_listing_info.remaining = listing_args.amount;

        token_listing_info.serialize(token_listing_info_account.to_account_info())
    }
}

#[account]
#[derive(Debug, InitSpace)]
pub struct MarketplaceCounter {
    pub nonce: u32,
}

impl MarketplaceCounter {
    pub const PREFIX_SEED: &'static [u8] = b"counter";
}

pub const MARKETPLACE_PREFIX_SEED: &'static [u8] = b"marketplace";
