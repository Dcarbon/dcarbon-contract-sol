use anchor_lang::{prelude::*, system_program::{create_account, CreateAccount}};
use anchor_lang::context::CpiContext;

use crate::error::DCarbonError;
use crate::ID;
use crate::state::BpfWriter;

#[account]
#[derive(Debug, InitSpace)]
pub struct Master {
    pub master_key: Pubkey,
}


impl Master {
    pub const PREFIX_SEED: &'static [u8] = b"master";

    fn from<'info>(x: &'info AccountInfo<'info>) -> Account<'info, Self> {
        Account::try_from_unchecked(x).unwrap()
    }

    fn serialize(&self, info: AccountInfo) -> anchor_lang::Result<()> {
        let dst: &mut [u8] = &mut info.try_borrow_mut_data().unwrap();
        let mut writer: BpfWriter<&mut [u8]> = BpfWriter::new(dst);
        Master::try_serialize(self, &mut writer)
    }


    pub fn init<'info>(
        master_pda: &'info AccountInfo<'info>,
        payer: AccountInfo<'info>,
        system_program: AccountInfo<'info>,
        address: Pubkey,
    ) -> Result<()> {
        // Check if master PDA is already initialized
        if !master_pda.data_is_empty() && !cfg!(feature = "testing") {
            return Err(DCarbonError::MasterIsAlreadyInit.into());
        }

        // Only perform initialization if not in testing mode
        if !cfg!(feature = "testing") {
            // Create the seeds and bump for PDA address calculation
            let seeds: &[&[u8]] = &[Master::PREFIX_SEED];
            let (_, bump) = Pubkey::find_program_address(&seeds, &ID);
            let seeds_signer = &mut seeds.to_vec();
            let binding = [bump];
            seeds_signer.push(&binding);

            let space: u64 = (8 + Master::INIT_SPACE) as u64;

            // Create account if it doesn't exist
            create_account(
                CpiContext::new(system_program, CreateAccount { from: payer, to: master_pda.clone() })
                    .with_signer(&[seeds_signer]),
                Rent::get()?.minimum_balance(space.try_into().unwrap()),
                space,
                &ID,
            )?;
        }

        // Update master PDA data with the provided address
        let mut master_pda_der = Master::from(master_pda);
        master_pda_der.master_key = address;
        master_pda_der.serialize(master_pda_der.to_account_info())
    }
}