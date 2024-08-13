use anchor_lang::prelude::*;
use crate::ID;
use crate::state::{Coefficient, Master};

pub fn set_coefficient(ctx: Context<SetCoefficient>, key: String, value: u64) -> Result<()> {
    let coefficient = &mut ctx.accounts.coefficient;

    // check and assign value
    coefficient.assign(key, value)
}

#[derive(Accounts)]
#[instruction(key: String)]
pub struct SetCoefficient<'info> {
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
        payer = signer,
        space = 8 + Coefficient::INIT_SPACE,
        seeds = [Coefficient::PREFIX_SEED, key.as_ref()],
        bump
    )]
    pub coefficient: Account<'info, Coefficient>,

    pub system_program: Program<'info, System>,
}