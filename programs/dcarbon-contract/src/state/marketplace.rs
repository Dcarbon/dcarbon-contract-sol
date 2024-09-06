use crate::instructions::ListingArgs;
use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct TokenListingInfo {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: f64,
    pub price: f64, // LAMPORT
    pub project_id: u16,
    pub currency: Option<Pubkey>,
    pub remaining: f64,
}

impl TokenListingInfo {
    pub const PREFIX_SEED: &'static [u8] = b"self";

    pub fn update(&mut self, listing_args: ListingArgs) -> Result<()> {
        self.amount += listing_args.amount;
        self.remaining += listing_args.amount;
        self.price += listing_args.price;
        Ok(())
    }

    pub fn assign(
        &mut self,
        listing_args: ListingArgs,
        signer_key: Pubkey,
        mint_key: Pubkey,
    ) -> Result<()> {
        self.owner = signer_key;
        self.mint = mint_key;
        self.amount = listing_args.amount;
        self.price = listing_args.price;
        self.project_id = listing_args.project_id;
        self.currency = listing_args.currency;
        self.remaining = listing_args.amount;

        Ok(())
    }
}

pub const MARKETPLACE_PREFIX_SEED: &'static [u8] = b"marketplace";
