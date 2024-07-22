use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use solana_program::program_memory::sol_memcmp;
use solana_program::pubkey::PUBKEY_BYTES;

use crate::error::DCarbonError;

pub fn cmp_pubkeys(a: &Pubkey, b: &Pubkey) -> bool {
    sol_memcmp(a.as_ref(), b.as_ref(), PUBKEY_BYTES) == 0
}

pub fn assert_keys_equal(key1: &Pubkey, key2: &Pubkey) -> Result<()> {
    if !cmp_pubkeys(key1, key2) {
        err!(DCarbonError::PublicKeyMismatch)
    } else {
        Ok(())
    }
}