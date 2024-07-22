use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Coefficient {
    pub value: u64,
}

impl Coefficient {
    pub const PREFIX_SEED: &'static [u8] = b"coefficient";
}
