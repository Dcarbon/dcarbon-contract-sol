use anchor_lang::prelude::*;

pub fn claim(ctx: Context<Claim>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub signer: Signer<'info>,
}
