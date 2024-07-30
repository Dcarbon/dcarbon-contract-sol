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
    pub rate: u64,
    pub minting_fee: u64,
    pub mint: Pubkey,
    #[max_len(100)]
    pub minting_limits: Vec<DeviceLimit>,
    pub governance_amount: u64,
}

impl ContractConfig {
    pub const PREFIX_SEED: &'static [u8] = b"contract_config";

    fn from<'info>(x: &'info AccountInfo<'info>) -> Account<'info, Self> {
        Account::try_from_unchecked(x).unwrap()
    }

    fn serialize(&self, info: AccountInfo) -> anchor_lang::Result<()> {
        let dst: &mut [u8] = &mut info.try_borrow_mut_data().unwrap();
        let mut writer: BpfWriter<&mut [u8]> = BpfWriter::new(dst);
        ContractConfig::try_serialize(self, &mut writer)
    }

    pub fn init<'info>(
        contract_config: &'info AccountInfo<'info>,
        payer: AccountInfo<'info>,
        system_program: AccountInfo<'info>,
        config_args: ConfigArgs,
        mint: Pubkey,
    ) -> Result<()> {
        // Check if master PDA is already initialized
        if !contract_config.data_is_empty() && !cfg!(feature = "testing") {
            return Err(DCarbonError::ContractConfigIsAlreadyInit.into());
        }

        // Only perform initialization if not in testing mode
        if contract_config.data_is_empty() {
            // Create the seeds and bump for PDA address calculation
            let seeds: &[&[u8]] = &[ContractConfig::PREFIX_SEED];
            let (_, bump) = Pubkey::find_program_address(&seeds, &ID);
            let seeds_signer = &mut seeds.to_vec();
            let binding = [bump];
            seeds_signer.push(&binding);

            let space: u64 = (8 + ContractConfig::INIT_SPACE) as u64;

            create_account(
                CpiContext::new(system_program, CreateAccount { from: payer, to: contract_config.clone() })
                    .with_signer(&[seeds_signer]),
                Rent::get()?.minimum_balance(space.try_into().unwrap()),
                space,
                &ID,
            )?;
        }

        let mut contract_config_der = ContractConfig::from(contract_config);
        contract_config_der.rate = config_args.rate;
        contract_config_der.minting_fee = config_args.minting_fee;
        contract_config_der.minting_limits = Vec::new();
        contract_config_der.mint = mint;
        contract_config_der.governance_amount = config_args.governance_amount;

        // serialize
        contract_config_der.serialize(contract_config_der.to_account_info())
    }
}