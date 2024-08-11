use anchor_lang::prelude::*;

pub fn mint_nft(ctx: Context<MintNft>) -> Result<()> {
    let _ = &ctx.accounts.signer;
    Ok(())
}

#[derive(Accounts)]
pub struct MintNft<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

}