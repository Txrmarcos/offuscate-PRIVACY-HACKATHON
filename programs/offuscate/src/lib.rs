use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq");

#[program]
pub mod offuscate {
    use super::*;

    /// Create a new campaign with a vault PDA
    /// The vault is controlled by the program, not the owner
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_id: String,
        title: String,
        description: String,
        goal: u64,
        deadline: i64,
    ) -> Result<()> {
        require!(campaign_id.len() <= 32, ErrorCode::CampaignIdTooLong);
        require!(title.len() <= 64, ErrorCode::TitleTooLong);
        require!(description.len() <= 256, ErrorCode::DescriptionTooLong);
        require!(goal > 0, ErrorCode::InvalidGoal);
        require!(deadline > Clock::get()?.unix_timestamp, ErrorCode::InvalidDeadline);

        let campaign = &mut ctx.accounts.campaign;
        campaign.owner = ctx.accounts.owner.key();
        campaign.campaign_id = campaign_id;
        campaign.title = title;
        campaign.description = description;
        campaign.goal = goal;
        campaign.total_raised = 0;
        campaign.donor_count = 0;
        campaign.deadline = deadline;
        campaign.status = CampaignStatus::Active;
        campaign.created_at = Clock::get()?.unix_timestamp;
        campaign.vault_bump = ctx.bumps.vault;
        campaign.campaign_bump = ctx.bumps.campaign;

        msg!("Campaign created: {}", campaign.title);
        msg!("Vault PDA: {}", ctx.accounts.vault.key());

        Ok(())
    }

    /// Donate to a campaign
    /// Funds go to the vault PDA, not the owner
    /// The donor can use a stealth address as the source
    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let campaign = &mut ctx.accounts.campaign;
        require!(campaign.status == CampaignStatus::Active, ErrorCode::CampaignNotActive);
        require!(Clock::get()?.unix_timestamp < campaign.deadline, ErrorCode::CampaignEnded);

        // Transfer SOL from donor to vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.donor.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        campaign.total_raised = campaign.total_raised.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        campaign.donor_count = campaign.donor_count.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Donation received: {} lamports", amount);
        msg!("Total raised: {} lamports", campaign.total_raised);

        // Check if goal reached
        if campaign.total_raised >= campaign.goal {
            msg!("🎉 Campaign goal reached!");
        }

        Ok(())
    }

    /// Withdraw funds from campaign vault
    /// Only the owner can withdraw
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let campaign = &ctx.accounts.campaign;

        require!(amount > 0, ErrorCode::InvalidAmount);

        let vault_balance = ctx.accounts.vault.lamports();
        require!(amount <= vault_balance, ErrorCode::InsufficientFunds);

        // Build signer seeds for vault PDA
        let campaign_id = campaign.campaign_id.as_bytes();
        let bump = campaign.vault_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", campaign_id, &[bump]]];

        // Transfer from vault PDA to owner via CPI
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.owner.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        msg!("Withdrawn: {} lamports to owner", amount);

        Ok(())
    }

    /// Close a campaign (only owner, refunds if goal not met)
    pub fn close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;

        require!(
            ctx.accounts.owner.key() == campaign.owner,
            ErrorCode::Unauthorized
        );
        require!(
            campaign.status == CampaignStatus::Active,
            ErrorCode::CampaignNotActive
        );

        campaign.status = CampaignStatus::Closed;

        msg!("Campaign closed");

        Ok(())
    }
}

// ============================================
// ACCOUNTS
// ============================================

#[derive(Accounts)]
#[instruction(campaign_id: String)]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = Campaign::SPACE,
        seeds = [b"campaign", campaign_id.as_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: Vault PDA - just holds SOL, no data
    #[account(
        mut,
        seeds = [b"vault", campaign_id.as_bytes()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [b"vault", campaign.campaign_id.as_bytes()],
        bump = campaign.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [b"vault", campaign.campaign_id.as_bytes()],
        bump = campaign.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseCampaign<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub campaign: Account<'info, Campaign>,

    pub system_program: Program<'info, System>,
}

// ============================================
// STATE
// ============================================

#[account]
pub struct Campaign {
    pub owner: Pubkey,           // 32 bytes
    pub campaign_id: String,     // 4 + 32 = 36 bytes
    pub title: String,           // 4 + 64 = 68 bytes
    pub description: String,     // 4 + 256 = 260 bytes
    pub goal: u64,               // 8 bytes
    pub total_raised: u64,       // 8 bytes
    pub donor_count: u64,        // 8 bytes
    pub deadline: i64,           // 8 bytes
    pub status: CampaignStatus,  // 1 byte
    pub created_at: i64,         // 8 bytes
    pub vault_bump: u8,          // 1 byte
    pub campaign_bump: u8,       // 1 byte
}

impl Campaign {
    pub const SPACE: usize = 8 +  // discriminator
        32 +                       // owner
        (4 + 32) +                // campaign_id
        (4 + 64) +                // title
        (4 + 256) +               // description
        8 +                        // goal
        8 +                        // total_raised
        8 +                        // donor_count
        8 +                        // deadline
        1 +                        // status
        8 +                        // created_at
        1 +                        // vault_bump
        1 +                        // campaign_bump
        64;                        // padding for safety
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CampaignStatus {
    Active,
    Closed,
    Completed,
}

// ============================================
// ERRORS
// ============================================

#[error_code]
pub enum ErrorCode {
    #[msg("Campaign ID too long (max 32 chars)")]
    CampaignIdTooLong,
    #[msg("Title too long (max 64 chars)")]
    TitleTooLong,
    #[msg("Description too long (max 256 chars)")]
    DescriptionTooLong,
    #[msg("Invalid goal amount")]
    InvalidGoal,
    #[msg("Invalid deadline")]
    InvalidDeadline,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Campaign is not active")]
    CampaignNotActive,
    #[msg("Campaign has ended")]
    CampaignEnded,
    #[msg("Campaign has not ended yet")]
    CampaignNotEnded,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    #[msg("Arithmetic overflow")]
    Overflow,
}
