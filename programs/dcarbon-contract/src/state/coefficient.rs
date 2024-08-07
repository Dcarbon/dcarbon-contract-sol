use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Coefficient {
    #[max_len(32)]
    pub key: String,
    pub value: u64,
}

impl Coefficient {
    pub const PREFIX_SEED: &'static [u8] = b"coefficient";
}
