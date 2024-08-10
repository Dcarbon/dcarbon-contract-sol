use anchor_lang::prelude::*;

pub fn swap_nft(ctx: Context<SwapNft>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct SwapNft<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

}