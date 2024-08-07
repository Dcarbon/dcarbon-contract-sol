use anchor_lang::prelude::*;

use crate::error::DCarbonError;
use crate::instructions::RegisterDeviceArgs;

#[derive(InitSpace, Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DeviceLimit {
    pub device_type: u16,
    pub limit: f64,
}

#[account]
#[derive(InitSpace, Debug)]
pub struct Device {
    pub id: u16,
    pub device_type: u16,
    pub project_id: u16,
    pub owner: Pubkey,
    pub minter: Pubkey,
}

impl Device {
    pub const PREFIX_SEED: &'static [u8] = b"device";

    // check device id length
    fn validate(&self, register_device_args: RegisterDeviceArgs) -> Result<()> {
        // check project_id
        if register_device_args.project_id > 0 {
            Ok(())
        } else {
            Err(DCarbonError::InvalidProjectIdLength.into())
        }
    }

    pub fn assign_value(&mut self, register_device_args: RegisterDeviceArgs) -> Result<()> {
        // validate
        self.validate(register_device_args.clone())?;

        self.id = register_device_args.device_id;
        self.device_type = register_device_args.device_type;
        self.project_id = register_device_args.project_id;
        self.owner = register_device_args.owner;
        self.minter = register_device_args.minter;

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