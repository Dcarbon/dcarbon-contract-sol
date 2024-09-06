use anchor_lang::prelude::*;

use crate::state::{Admin, Master};
use crate::ID;

pub fn add_admin<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, AddAdmin<'info>>,
    address: Pubkey,
) -> Result<()> {
    let signer: &Signer<'info> = &ctx.accounts.signer;
    let system_program: &Program<'info, System> = &ctx.accounts.system_program;

    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();

    let admin = next_account_info(remaining_accounts_iter).unwrap();

    Admin::init(
        admin,
        signer.to_account_info(),
        system_program.to_account_info(),
        address,
    )
}

pub fn delete_admin(_ctx: Context<DeleteAdmin>, _address: Pubkey) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct AddAdmin<'info> {
    #[account(
        mut,
        constraint = signer.key() == master_pda.master_key
    )]
    pub signer: Signer<'info>,

    #[account(
        seeds = [Master::PREFIX_SEED],
        bump,
        owner = ID,
    )]
    pub master_pda: Account<'info, Master>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_address: Pubkey)]
pub struct DeleteAdmin<'info> {
    #[account(
        mut,
        constraint = signer.key() == master_pda.master_key
    )]
    pub signer: Signer<'info>,

    #[account(
        seeds = [Master::PREFIX_SEED],
        bump,
        owner = ID,
    )]
    pub master_pda: Account<'info, Master>,

    #[account(
        mut,
        seeds = [Admin::PREFIX_SEED, _address.key().as_ref()],
        bump,
        owner = ID,
        close = signer
    )]
    /// CHECK:
    pub admin_pda: Account<'info, Admin>,
}
