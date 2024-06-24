use anchor_lang::prelude::*;

use instructions::*;
use state::*;

mod state;
mod instructions;

declare_id!("bM6u1BRUQiFD1xEDPpqqGMMoLExtnmiPeb8NtXPDtg3");

#[program]
pub mod dcarbon_contract {
    use super::*;

    pub fn register_project(ctx: Context<RegisterProject>, project_args: Project, create_data_vec: Vec<u8>) -> Result<()> {
        instructions::register_project(ctx, project_args, create_data_vec)
    }

    pub fn create_mint(ctx: Context<CreateMint>, create_data_vec: Vec<u8>) -> Result<()> {
        instructions::create_mint(ctx, create_data_vec)
    }

    pub fn mint_sft(ctx: Context<MintSft>, project_id: String, mint_data_vec: Vec<u8>) -> Result<()> {
        instructions::mint_sft(ctx, project_id, mint_data_vec)
    }

    pub fn transform(ctx: Context<Transform>, burn_data_vec: Vec<u8>, mint_data_vec: Vec<u8>) -> Result<()> {
        instructions::transform(ctx, burn_data_vec, mint_data_vec)
    }

}

#[derive(Accounts)]
pub struct Initialize {}
