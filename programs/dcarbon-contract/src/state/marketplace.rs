use anchor_lang::prelude::*;

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
}

#[account]
#[derive(Debug, InitSpace)]
pub struct TokenListingStatus {
    pub total_amount: f64,
    pub remaining: f64,
    pub out_of_token: bool,
}

impl TokenListingStatus {
    pub const PREFIX_SEED: &'static [u8] = b"token_listing_status";
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
