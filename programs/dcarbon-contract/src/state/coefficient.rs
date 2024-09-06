use anchor_lang::prelude::*;

use crate::error::DCarbonError;

#[account]
#[derive(Debug, InitSpace)]
pub struct Coefficient {
    #[max_len(32)]
    pub key: String,
    pub value: u64,
}

impl Coefficient {
    pub const PREFIX_SEED: &'static [u8] = b"coefficient";

    pub fn validate(&self, key: String, value: u64) -> Result<()> {
        // check value
        if value <= 0 {
            return Err(DCarbonError::InvalidValue.into());
        }

        // check key
        if key.len() as u8 >= 32 {
            return Err(DCarbonError::InvalidStringLength.into());
        }

        Ok(())
    }

    pub fn assign(&mut self, key: String, value: u64) -> Result<()> {
        self.validate(key.clone(), value)?;

        self.key = key;
        self.value = value;

        Ok(())
    }
}
