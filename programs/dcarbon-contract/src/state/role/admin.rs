use anchor_lang::{prelude::*, system_program::{create_account, CreateAccount}};
use anchor_lang::context::CpiContext;

use crate::error::DCarbonError;
use crate::ID;
use crate::state::BpfWriter;

#[account]
#[derive(Debug, InitSpace)]
pub struct Admin {
    pub admin_key: Pubkey,
}

impl Admin {
    pub const PREFIX_SEED: &'static [u8] = b"admin";

    fn from<'info>(x: &'info AccountInfo<'info>) -> Account<'info, Self> {
        Account::try_from_unchecked(x).unwrap()
    }

    fn serialize(&self, info: AccountInfo) -> anchor_lang::Result<()> {
        let dst: &mut [u8] = &mut info.try_borrow_mut_data().unwrap();
        let mut writer: BpfWriter<&mut [u8]> = BpfWriter::new(dst);
        Admin::try_serialize(self, &mut writer)
    }


    pub fn init<'info>(
        admin_pda: &'info AccountInfo<'info>,
        payer: AccountInfo<'info>,
        system_program: AccountInfo<'info>,
        address: Pubkey,
    ) -> Result<()> {
        // Check if Admin PDA is already initialized
        if !admin_pda.data_is_empty() && !cfg!(feature = "testing") {
            return Err(DCarbonError::AdminIsAlreadyInit.into());
        }

        // Only perform initialization if not in testing mode
        if admin_pda.data_is_empty() {
            // Create the seeds and bump for PDA address calculation
            let seeds: &[&[u8]] = &[Admin::PREFIX_SEED, address.as_ref()];
            let (_, bump) = Pubkey::find_program_address(&seeds, &ID);
            let seeds_signer = &mut seeds.to_vec();
            let binding = [bump];
            seeds_signer.push(&binding);

            let space: u64 = (8 + Admin::INIT_SPACE) as u64;

            // Create account if it doesn't exist
            create_account(
                CpiContext::new(system_program, CreateAccount { from: payer, to: admin_pda.clone() })
                    .with_signer(&[seeds_signer]),
                Rent::get()?.minimum_balance(space.try_into().unwrap()),
                space,
                &ID,
            )?;
        }

        // Update Admin PDA data with the provided address
        let mut admin_pda_der = Admin::from(admin_pda);
        admin_pda_der.admin_key = address;
        admin_pda_der.serialize(admin_pda_der.to_account_info())
    }
}