use anchor_lang::prelude::*;
use anchor_spl::token::{self as token, transfer, Mint, Token, TokenAccount, Transfer};

use crate::error::DCarbonError;
use crate::state::Governance;
use crate::ID;

pub fn claim_governance_token(ctx: Context<ClaimGovernanceToken>) -> Result<()> {
    let governance = &mut ctx.accounts.governance;
    let token_mint = &ctx.accounts.token_mint;

    // check if governance amount is equal 0
    if governance.amount <= 0.0 {
        return Err(DCarbonError::DontHaveEnoughAmountToClaim.into());
    }

    let seeds: &[&[u8]] = &[b"authority"];

    let (_, bump) = Pubkey::find_program_address(&seeds, &ID);

    let seeds_signer = &mut seeds.to_vec();
    let binding = [bump];
    seeds_signer.push(&binding);

    let transfer_accounts = Transfer {
        from: ctx.accounts.token_ata_sender.to_account_info(),
        to: ctx.accounts.token_ata_receiver.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };

    let bind: &[&[&[u8]]] = &[seeds_signer];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
        bind,
    );

    transfer(
        cpi_ctx,
        (governance.amount * 10f64.powf(token_mint.decimals as f64)).round() as u64,
    )?;

    governance.amount = 0.0;

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimGovernanceToken<'info> {
    #[account(
        mut,
        constraint = signer.key() == governance.owner
    )]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub governance: Box<Account<'info, Governance>>,

    // DCarbon
    #[account(
        constraint = token_mint.key() == governance.mint
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        seeds = [b"authority"],
        bump,
        owner = ID,
    )]
    /// CHECK:
    pub authority: AccountInfo<'info>,

    #[account(
        mut,
        constraint = token_ata_sender.mint == token_mint.key(),
        constraint = token_ata_sender.owner == authority.key()
    )]
    pub token_ata_sender: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = token_ata_receiver.mint == token_mint.key(),
        constraint = token_ata_receiver.owner == signer.key()
    )]
    pub token_ata_receiver: Box<Account<'info, TokenAccount>>,

    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
}
