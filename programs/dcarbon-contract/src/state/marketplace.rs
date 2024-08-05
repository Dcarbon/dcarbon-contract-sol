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

pub const MARKETPLACE_PREFIX_SEED: &'static [u8] = b"marketplace";
