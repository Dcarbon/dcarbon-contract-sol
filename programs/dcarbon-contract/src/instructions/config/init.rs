use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::ID;
use crate::state::{ContractConfig, Governance, Master};

pub fn init_config(
    ctx: Context<InitConfig>,
    config_args: ConfigArgs,
) -> Result<()> {
    let contract_config = &mut ctx.accounts.contract_config;
    let mint = &ctx.accounts.mint;
    let governance = &mut ctx.accounts.governance;

    // amount without decimal
    governance.amount = config_args.governance_amount;

    contract_config.assign(config_args, mint.key())
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

    #[account(
        init_if_needed,
        space = 8 + ContractConfig::INIT_SPACE,
        payer = signer,
        seeds = [ContractConfig::PREFIX_SEED],
        bump,
    )]
    pub contract_config: Account<'info, ContractConfig>,

    #[account(
        init_if_needed,
        space = 8 + Governance::INIT_SPACE,
        payer = signer,
        seeds = [Governance::PREFIX_SEED],
        bump
    )]
    pub governance: Account<'info, Governance>,

    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConfigArgs {
    pub minting_fee: f64,
    pub rate: f64,
    pub governance_amount: f64,
}
