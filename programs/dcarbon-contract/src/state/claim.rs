use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Claim {
    pub is_claimed: bool,
    pub mint: Pubkey,
    pub amount: u64
}

impl Claim {
    pub const PREFIX_SEED: &'static [u8] = b"claim";

}