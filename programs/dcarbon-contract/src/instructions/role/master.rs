use anchor_lang::prelude::*;

use crate::state::Master;
use crate::{program::DcarbonContract, ID};

pub fn init_master<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InitMaster<'info>>,
    address: Pubkey,
) -> Result<()> {
    let signer: &Signer<'info> = &ctx.accounts.signer;
    let system_program: &Program<'info, System> = &ctx.accounts.system_program;

    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();

    let master = next_account_info(remaining_accounts_iter).unwrap();

    Master::init(
        master,
        signer.to_account_info(),
        system_program.to_account_info(),
        address,
    )
}

pub fn transfer_master_rights(
    ctx: Context<TransferMasterRights>,
    new_master_address: Pubkey,
) -> Result<()> {
    let master = &mut ctx.accounts.master_pda;
    master.master_key = new_master_address;
    Ok(())
}

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct InitMaster<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,

    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, DcarbonContract>,

    #[account(constraint = program_data.upgrade_authority_address == Some(signer.key()))]
    pub program_data: Account<'info, ProgramData>,
}

#[derive(Accounts)]
pub struct TransferMasterRights<'info> {
    #[account(
        mut,
        constraint = signer.key() == master_pda.master_key
    )]
    pub signer: Signer<'info>,

    #[account(
        mut,
        owner = ID,
        seeds = [Master::PREFIX_SEED],
        bump
    )]
    pub master_pda: Account<'info, Master>,
}
