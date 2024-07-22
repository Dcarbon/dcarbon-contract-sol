use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::ID;
use crate::state::{ContractConfig, Master};

pub fn init_config<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InitConfig<'info>>,
    config_args: ConfigArgs,
) -> Result<()> {
    let signer = &ctx.accounts.signer;
    let system_program = &ctx.accounts.system_program;
    let mint = &ctx.accounts.mint;

    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();

    let contract_config = next_account_info(remaining_accounts_iter).unwrap();

    ContractConfig::init(contract_config, signer.to_account_info(), system_program.to_account_info(), config_args, mint.key())
}

#[derive(Accounts)]
pub struct InitConfig<'info> {
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

    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConfigArgs {
    pub minting_fee: u64,
    pub rate: u64,
}
