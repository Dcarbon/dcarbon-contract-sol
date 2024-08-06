use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct TokenListingInfo {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub price: u64, // LAMPORT
    pub project_id: u16,
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
