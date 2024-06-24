use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Project {
    #[max_len(24)]
    pub id: String,
    pub mint: Pubkey,
    pub config: ProjectConfig,
}

impl Project {
    pub const PREFIX_SEED: &'static [u8] = b"project";

    pub fn assign(&mut self, project_args: Project) -> Result<()> {
        self.id = project_args.id;
        self.mint = project_args.mint;
        self.config = project_args.config;

        Ok(())
    }
}

#[derive(InitSpace, Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProjectConfig {}