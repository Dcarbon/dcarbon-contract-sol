use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Governance {
    pub owner: Pubkey,
    pub amount: f64,
}

impl Governance {
    pub const PREFIX_SEED: &'static [u8] = b"governance";
}
