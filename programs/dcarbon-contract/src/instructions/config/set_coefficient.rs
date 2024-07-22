use anchor_lang::prelude::*;

use crate::state::{Coefficient, Master};

use crate::ID;

pub fn set_coefficient(ctx: Context<SetCoefficient>, _device_id: String, value: u64) -> Result<()> {
    let coefficient = &mut ctx.accounts.coefficient;

    coefficient.value = value;

    Ok(())
}

#[derive(Accounts)]
#[instruction(_device_id: String)]
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
        seeds = [Coefficient::PREFIX_SEED, _device_id.as_bytes()],
        bump
    )]
    pub coefficient: Account<'info, Coefficient>,

    pub system_program: Program<'info, System>,
}