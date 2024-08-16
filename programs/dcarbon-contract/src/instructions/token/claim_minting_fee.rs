use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use crate::state::Claim;

pub fn claim_minting_fee(_ctx: Context<ClaimMintingFee>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimMintingFee<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [Claim::PREFIX_SEED, mint.key().as_ref()],
        bump
    )]
    pub claim: Box<Account<'info, Claim>>,

    #[account(

    )]

    /// CHECK:
    #[account(mut)]
    pub mint: Account<'info, Mint>,


}