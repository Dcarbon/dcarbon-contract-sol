use anchor_lang::prelude::*;
use crate::state::{ContractConfig, Master};
use crate::ID;

#[derive(Accounts)]
pub struct SetConfig<'info> {
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
        seeds = [ContractConfig::PREFIX_SEED],
        bump
    )]
    pub contract_config: Account<'info, ContractConfig>,

    pub system_program: Program<'info, System>,
}