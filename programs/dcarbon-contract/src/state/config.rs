use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, CreateAccount};

use crate::error::DCarbonError;
use crate::ID;
use crate::instructions::ConfigArgs;
use crate::state::{BpfWriter, DeviceLimit};

#[account]
#[derive(Debug, InitSpace)]
pub struct ContractConfig {
    // unlock rate for DCARBON when mint sFT
    pub rate: f64,
    pub minting_fee: f64,
    pub mint: Pubkey,
    #[max_len(100)]
    pub minting_limits: Vec<DeviceLimit>,
    pub governance_amount: u64,
}

impl ContractConfig {
    pub const PREFIX_SEED: &'static [u8] = b"contract_config";

    pub fn validate(&self, config_args: ConfigArgs) -> Result<()> {
        if config_args.rate <= 0.0 || config_args.minting_fee <= 0.0 || config_args.governance_amount <= 0 {
            return Err(DCarbonError::InitArgsInvalid.into());
        }
        Ok(())
    }
    pub fn assign(&mut self, config_args: ConfigArgs, mint: Pubkey) -> Result<()> {
        self.validate(config_args.clone())?;

        self.rate = config_args.rate;
        self.minting_fee = config_args.minting_fee;
        self.governance_amount = config_args.governance_amount;
        self.mint = mint;
        self.minting_limits = Vec::new();
        Ok(())
    }
}