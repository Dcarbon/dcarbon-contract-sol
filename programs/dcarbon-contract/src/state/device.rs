use anchor_lang::prelude::*;

use crate::error::DCarbonError;
use crate::instructions::RegisterDeviceArgs;

#[derive(InitSpace, Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DeviceLimit {
    pub device_type: u16,
    pub limit: u16,
}

#[account]
#[derive(InitSpace, Debug)]
pub struct Device {
    #[max_len(24)]
    pub id: String,
    pub device_type: u16,
    pub mint: Pubkey,
    #[max_len(24)]
    pub project_id: String,
}

impl Device {
    pub const PREFIX_SEED: &'static [u8] = b"device";

    // check device id length
    fn validate(&self) -> Result<()> {
        // check project_id
        if self.project_id.len() == 24 {
            Ok(())
        } else {
            Err(DCarbonError::InvalidProjectIdLength.into())
        }
    }

    pub fn assign_value(&mut self, register_device_args: RegisterDeviceArgs, mint: Pubkey) -> Result<()> {
        // validate
        self.validate()?;

        self.id = register_device_args.device_id;
        self.device_type = register_device_args.device_type;
        self.project_id = register_device_args.project_id;
        self.mint = mint.key();

        Ok(())
    }
}

#[account]
#[derive(Debug, InitSpace)]
pub struct DeviceStatus {
    pub device_key: Pubkey,
    pub is_active: bool,
    pub last_mint_time: i64,
    pub nonce: u16,
}

impl DeviceStatus {
    pub const PREFIX_SEED: &'static [u8] = b"device_status";
}