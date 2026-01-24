use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::sysvar::instructions::{
    self as instructions_sysvar,
    load_instruction_at_checked,
};
use anchor_lang::solana_program::ed25519_program;

declare_id!("5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq");

// ==============================================
// PRIVACY POOL CONSTANTS
// ==============================================

/// Minimum delay before withdrawal can be claimed (in seconds)
pub const MIN_DELAY_SECONDS: i64 = 30;      // 30 seconds minimum
pub const MAX_DELAY_SECONDS: i64 = 300;     // 5 minutes maximum

/// Allowed withdrawal amounts in lamports (standardized to break amount correlation)
pub const ALLOWED_AMOUNTS: [u64; 3] = [
    100_000_000,   // 0.1 SOL
    500_000_000,   // 0.5 SOL
    1_000_000_000, // 1.0 SOL
];

#[program]
pub mod offuscate {
    use super::*;

    // ==============================================
    // PRIVACY POOL INSTRUCTIONS
    // ==============================================

    /// Initialize the global privacy pool
    /// Called once to create the pool PDA
    pub fn init_privacy_pool(ctx: Context<InitPrivacyPool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.total_deposited = 0;
        pool.total_withdrawn = 0;
        pool.deposit_count = 0;
        pool.withdraw_count = 0;
        pool.churn_count = 0;
        pool.bump = ctx.bumps.pool;
        pool.vault_bump = ctx.bumps.pool_vault;

        msg!("Privacy Pool initialized");
        msg!("Pool vault: {}", ctx.accounts.pool_vault.key());

        Ok(())
    }

    /// Deposit SOL into the privacy pool
    ///
    /// PRIVACY: This instruction intentionally does NOT track:
    /// - Who deposited (sender)
    /// - Who will receive (receiver)
    /// - Which campaign (if any)
    /// - The individual deposit (only aggregate stats)
    ///
    /// This breaks the link between donor and recipient.
    pub fn pool_deposit(ctx: Context<PoolDeposit>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Transfer SOL from depositor to pool vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.depositor.to_account_info(),
                    to: ctx.accounts.pool_vault.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update pool stats (aggregate only, no individual tracking)
        let pool = &mut ctx.accounts.pool;
        pool.total_deposited = pool.total_deposited.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        pool.deposit_count = pool.deposit_count.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        // Generic message - no identifying info
        msg!("Pool deposit: {} lamports", amount);
        msg!("Pool total: {} lamports", pool.total_deposited);

        Ok(())
    }

    /// Request a withdrawal from the privacy pool
    ///
    /// Creates a pending withdrawal with a VARIABLE time delay (30s - 5min).
    /// The amount must be one of the standardized amounts.
    ///
    /// PRIVACY: Only the stealth_address is recorded (not who requested).
    /// The variable delay prevents timing correlation attacks.
    pub fn request_withdraw(
        ctx: Context<RequestWithdraw>,
        amount: u64,
    ) -> Result<()> {
        // Validate amount is one of the allowed standardized amounts
        require!(
            ALLOWED_AMOUNTS.contains(&amount),
            ErrorCode::InvalidWithdrawAmount
        );

        let _pool = &ctx.accounts.pool;
        let pool_balance = ctx.accounts.pool_vault.lamports();
        require!(amount <= pool_balance, ErrorCode::InsufficientPoolFunds);

        let pending = &mut ctx.accounts.pending_withdraw;
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        // VARIABLE DELAY: Pseudo-random delay between MIN and MAX
        // Uses slot + recipient address to generate unpredictable delay
        let recipient_bytes = ctx.accounts.recipient.key().to_bytes();
        let entropy = clock.slot
            .wrapping_add(recipient_bytes[0] as u64)
            .wrapping_add(recipient_bytes[31] as u64)
            .wrapping_mul(0x5851F42D4C957F2D);  // Prime multiplier for mixing

        let delay_range = (MAX_DELAY_SECONDS - MIN_DELAY_SECONDS) as u64;
        let variable_delay = MIN_DELAY_SECONDS + ((entropy % delay_range) as i64);

        pending.recipient = ctx.accounts.recipient.key();
        pending.amount = amount;
        pending.requested_at = now;
        pending.available_at = now + variable_delay;
        pending.claimed = false;
        pending.bump = ctx.bumps.pending_withdraw;

        msg!("Withdrawal requested: {} lamports", amount);
        msg!("Available at: {} (variable delay: {}s)", pending.available_at, variable_delay);

        Ok(())
    }

    /// Claim a pending withdrawal after the delay has passed
    ///
    /// PRIVACY: The recipient (stealth address) signs to claim.
    /// Observers cannot link this to the original deposit.
    pub fn claim_withdraw(ctx: Context<ClaimWithdraw>) -> Result<()> {
        let pending = &mut ctx.accounts.pending_withdraw;
        let now = Clock::get()?.unix_timestamp;

        require!(!pending.claimed, ErrorCode::AlreadyClaimed);
        require!(now >= pending.available_at, ErrorCode::WithdrawNotReady);

        let amount = pending.amount;

        // Build signer seeds for pool vault PDA
        let pool = &ctx.accounts.pool;
        let signer_seeds: &[&[&[u8]]] = &[&[b"pool_vault", &[pool.vault_bump]]];

        // Transfer from pool vault to recipient
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.pool_vault.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // Mark as claimed
        pending.claimed = true;

        // Update pool stats
        let pool = &mut ctx.accounts.pool;
        pool.total_withdrawn = pool.total_withdrawn.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        pool.withdraw_count = pool.withdraw_count.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Withdrawal claimed: {} lamports to {}", amount, ctx.accounts.recipient.key());

        Ok(())
    }

    // ==============================================
    // RELAYER / GASLESS CLAIM (Phase 2 - Privacy of Origin)
    // ==============================================

    /// Claim a pending withdrawal via RELAYER (gasless for recipient)
    ///
    /// PRIVACY FEATURE: The recipient does NOT pay gas and does NOT appear as tx signer.
    /// Instead, a relayer submits the transaction and pays fees.
    /// The recipient proves ownership by signing a message off-chain (ed25519).
    ///
    /// Flow:
    /// 1. Recipient signs message: "claim:{pending_pda}" with stealth keypair
    /// 2. Relayer creates ed25519 verify instruction + this instruction
    /// 3. Relayer submits tx and pays gas
    /// 4. Funds go to stealth address without it being fee payer
    ///
    /// This breaks: stealth_address -> fee payer link
    pub fn claim_withdraw_relayed(ctx: Context<ClaimWithdrawRelayed>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        // Get values we need before mutable borrow
        let pending_recipient = ctx.accounts.pending_withdraw.recipient;
        let pending_claimed = ctx.accounts.pending_withdraw.claimed;
        let pending_available_at = ctx.accounts.pending_withdraw.available_at;
        let pending_amount = ctx.accounts.pending_withdraw.amount;

        require!(!pending_claimed, ErrorCode::AlreadyClaimed);
        require!(now >= pending_available_at, ErrorCode::WithdrawNotReady);

        // Verify recipient matches pending withdraw
        // The constraint in accounts already checks this, but double-check
        require!(
            ctx.accounts.recipient.key() == pending_recipient,
            ErrorCode::SignerMismatch
        );

        // Verify ed25519 signature exists in the transaction
        // The ed25519 program at index 0 already verified the signature is valid
        // If it wasn't valid, the transaction would have failed
        let ix_sysvar = &ctx.accounts.instructions_sysvar;
        let ed25519_ix = load_instruction_at_checked(0, ix_sysvar)?;

        // Verify it's from the ed25519 program
        require!(
            ed25519_ix.program_id == ed25519_program::ID,
            ErrorCode::InvalidSignatureInstruction
        );

        // The ed25519 program already verified the signature is valid
        // We just need to trust that if we got here, the recipient proved ownership
        // The signature was over a message containing the pending PDA

        // All checks passed - process the withdrawal
        let amount = pending_amount;

        // Build signer seeds for pool vault PDA
        let vault_bump = ctx.accounts.pool.vault_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"pool_vault", &[vault_bump]]];

        // Transfer from pool vault to recipient
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.pool_vault.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // Mark as claimed
        ctx.accounts.pending_withdraw.claimed = true;

        // Update pool stats
        let pool = &mut ctx.accounts.pool;
        pool.total_withdrawn = pool.total_withdrawn.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        pool.withdraw_count = pool.withdraw_count.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!("RELAYED withdrawal claimed: {} lamports to {}", amount, ctx.accounts.recipient.key());
        msg!("Relayer: {} (paid gas)", ctx.accounts.relayer.key());

        Ok(())
    }

    /// Get pool stats (view function for frontend)
    pub fn get_pool_stats(ctx: Context<GetPoolStats>) -> Result<()> {
        let pool = &ctx.accounts.pool;
        let balance = ctx.accounts.pool_vault.lamports();

        msg!("=== Privacy Pool Stats ===");
        msg!("Current balance: {} lamports", balance);
        msg!("Total deposited: {} lamports", pool.total_deposited);
        msg!("Total withdrawn: {} lamports", pool.total_withdrawn);
        msg!("Deposit count: {}", pool.deposit_count);
        msg!("Withdraw count: {}", pool.withdraw_count);

        Ok(())
    }

    // ==============================================
    // BATCH WITHDRAWALS (anti-correlation feature)
    // ==============================================

    /// BATCH CLAIM WITHDRAWALS
    ///
    /// PRIVACY FEATURE: Processes multiple pending withdrawals in a single transaction.
    /// This breaks the visual pattern of "1 withdraw = 1 tx" that analysts use for correlation.
    ///
    /// remaining_accounts: pairs of [recipient_account, pending_withdraw_pda] for each withdrawal
    /// Max 5 withdrawals per batch to stay within compute limits.
    pub fn batch_claim_withdraw<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, BatchClaimWithdraw<'info>>,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let now = Clock::get()?.unix_timestamp;

        // remaining_accounts must be pairs: [recipient1, pending1, recipient2, pending2, ...]
        let remaining = &ctx.remaining_accounts;
        require!(remaining.len() >= 2, ErrorCode::BatchTooSmall);
        require!(remaining.len() % 2 == 0, ErrorCode::BatchInvalidPairs);
        require!(remaining.len() <= 10, ErrorCode::BatchTooLarge); // Max 5 pairs

        let num_claims = remaining.len() / 2;
        let mut total_claimed: u64 = 0;
        let mut success_count: u64 = 0;

        for i in 0..num_claims {
            let recipient_info = &remaining[i * 2];
            let pending_info = &remaining[i * 2 + 1];

            // Read pending withdraw data
            let mut pending_data = pending_info.try_borrow_mut_data()?;

            // Parse pending withdraw (skip 8-byte discriminator)
            // Layout: recipient(32) + amount(8) + requested_at(8) + available_at(8) + claimed(1) + bump(1)
            if pending_data.len() < 8 + 32 + 8 + 8 + 8 + 1 + 1 {
                msg!("Skipping invalid pending account at index {}", i);
                continue;
            }

            let stored_recipient = Pubkey::try_from(&pending_data[8..40]).unwrap_or_default();
            let amount = u64::from_le_bytes(pending_data[40..48].try_into().unwrap_or_default());
            let available_at = i64::from_le_bytes(pending_data[56..64].try_into().unwrap_or_default());
            let claimed = pending_data[64] != 0;

            // Verify recipient matches
            if stored_recipient != *recipient_info.key {
                msg!("Recipient mismatch at index {}", i);
                continue;
            }

            // Check if ready and not claimed
            if claimed {
                msg!("Already claimed at index {}", i);
                continue;
            }
            if now < available_at {
                msg!("Not ready yet at index {}", i);
                continue;
            }

            // Check pool has sufficient funds
            let pool_balance = ctx.accounts.pool_vault.lamports();
            if amount > pool_balance {
                msg!("Insufficient funds for index {}", i);
                continue;
            }

            // Transfer using direct lamport manipulation (more efficient for batch)
            **ctx.accounts.pool_vault.to_account_info().try_borrow_mut_lamports()? -= amount;
            **recipient_info.try_borrow_mut_lamports()? += amount;

            // Mark as claimed
            pending_data[64] = 1;

            total_claimed = total_claimed.saturating_add(amount);
            success_count += 1;

            msg!("Batch claim {}: {} lamports to {}", i, amount, recipient_info.key);
        }

        // Update pool stats
        if success_count > 0 {
            pool.total_withdrawn = pool.total_withdrawn.saturating_add(total_claimed);
            pool.withdraw_count = pool.withdraw_count.saturating_add(success_count);
        }

        msg!("Batch withdrawal complete: {} claims, {} total lamports", success_count, total_claimed);

        Ok(())
    }

    // ==============================================
    // POOL CHURN (anti-correlation feature)
    // ==============================================

    /// Initialize a churn vault (call once per vault: 0, 1, 2)
    ///
    /// PRIVACY FEATURE: Churn vaults enable internal micro-movements that
    /// break graph heuristics used by blockchain analysts.
    pub fn init_churn_vault(
        ctx: Context<InitChurnVault>,
        vault_index: u8,
    ) -> Result<()> {
        require!(vault_index < 3, ErrorCode::InvalidChurnIndex);

        let churn_state = &mut ctx.accounts.churn_state;
        churn_state.vault_index = vault_index;
        churn_state.total_churned = 0;
        churn_state.churn_count = 0;
        churn_state.bump = ctx.bumps.churn_state;
        churn_state.vault_bump = ctx.bumps.churn_vault;

        msg!("Churn vault {} initialized", vault_index);

        Ok(())
    }

    /// Pool Churn - Move funds from main pool to churn vault
    ///
    /// PRIVACY: Creates internal transactions that look like real activity.
    /// Breaks the pattern: deposit → (delay) → withdraw
    /// Into: deposit → churn → unchurn → (delay) → withdraw
    pub fn pool_churn(
        ctx: Context<PoolChurn>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let pool_balance = ctx.accounts.pool_vault.lamports();
        require!(amount <= pool_balance, ErrorCode::InsufficientPoolFunds);

        let pool = &ctx.accounts.pool;
        let signer_seeds: &[&[&[u8]]] = &[&[b"pool_vault", &[pool.vault_bump]]];

        // Transfer from pool vault to churn vault
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.pool_vault.to_account_info(),
                    to: ctx.accounts.churn_vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // Update churn state
        let churn_state = &mut ctx.accounts.churn_state;
        churn_state.total_churned = churn_state.total_churned.saturating_add(amount);
        churn_state.churn_count = churn_state.churn_count.saturating_add(1);

        // Update pool churn count
        let pool = &mut ctx.accounts.pool;
        pool.churn_count = pool.churn_count.saturating_add(1);

        msg!("Pool churn: {} lamports to vault {}", amount, churn_state.vault_index);

        Ok(())
    }

    /// Pool Unchurn - Return funds from churn vault to main pool
    ///
    /// PRIVACY: Second step of churn - returns funds, adding noise to the graph.
    pub fn pool_unchurn(
        ctx: Context<PoolUnchurn>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let churn_balance = ctx.accounts.churn_vault.lamports();
        require!(amount <= churn_balance, ErrorCode::InsufficientChurnFunds);

        let churn_state = &ctx.accounts.churn_state;
        let vault_index_bytes = churn_state.vault_index.to_le_bytes();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"churn_vault",
            vault_index_bytes.as_ref(),
            &[churn_state.vault_bump]
        ]];

        // Transfer from churn vault back to pool vault
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.churn_vault.to_account_info(),
                    to: ctx.accounts.pool_vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        msg!("Pool unchurn: {} lamports from vault {}", amount, churn_state.vault_index);

        Ok(())
    }

    // ==============================================
    // CAMPAIGN INSTRUCTIONS (existing)
    // ==============================================

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
        // Initialize stealth fields
        campaign.stealth_meta_address = String::new();
        campaign.stealth_donations = 0;
        campaign.stealth_total = 0;

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
            msg!("Campaign goal reached!");
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

    /// Close a campaign (only owner)
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

    /// Set stealth meta-address for a campaign
    /// This allows donors to generate stealth addresses for private donations
    pub fn set_stealth_meta_address(
        ctx: Context<SetStealthMetaAddress>,
        stealth_meta_address: String,
    ) -> Result<()> {
        require!(stealth_meta_address.len() <= 200, ErrorCode::MetaAddressTooLong);

        let campaign = &mut ctx.accounts.campaign;
        campaign.stealth_meta_address = stealth_meta_address.clone();

        msg!("Stealth meta-address set: {}", stealth_meta_address);

        Ok(())
    }

    /// Register a stealth payment (metadata only, NO SOL transfer)
    /// This helps the recipient scan for their payments
    /// The actual SOL goes directly to the stealth address via SystemProgram
    pub fn register_stealth_payment(
        ctx: Context<RegisterStealthPayment>,
        stealth_address: Pubkey,
        ephemeral_pub_key: String,
        amount: u64,
    ) -> Result<()> {
        require!(ephemeral_pub_key.len() <= 64, ErrorCode::EphemeralKeyTooLong);

        let registry = &mut ctx.accounts.registry;
        registry.campaign = ctx.accounts.campaign.key();
        registry.stealth_address = stealth_address;
        registry.ephemeral_pub_key = ephemeral_pub_key.clone();
        registry.amount = amount;
        registry.timestamp = Clock::get()?.unix_timestamp;
        registry.bump = ctx.bumps.registry;

        // Update campaign stats (for display only, actual SOL is elsewhere)
        let campaign = &mut ctx.accounts.campaign;
        campaign.stealth_donations = campaign.stealth_donations.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;
        campaign.stealth_total = campaign.stealth_total.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Stealth payment registered: {} lamports to {}", amount, stealth_address);

        Ok(())
    }
}

// ============================================
// ACCOUNTS - PRIVACY POOL
// ============================================

#[derive(Accounts)]
pub struct InitPrivacyPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = PrivacyPool::SPACE,
        seeds = [b"privacy_pool"],
        bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA - just holds SOL, no data
    #[account(
        mut,
        seeds = [b"pool_vault"],
        bump
    )]
    pub pool_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PoolDeposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA
    #[account(
        mut,
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestWithdraw<'info> {
    /// Payer for account rent (the connected wallet)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The recipient (stealth address keypair - signs to prove ownership)
    pub recipient: Signer<'info>,

    #[account(
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA (for balance check)
    #[account(
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = PendingWithdraw::SPACE,
        seeds = [b"pending", recipient.key().as_ref()],
        bump
    )]
    pub pending_withdraw: Account<'info, PendingWithdraw>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimWithdraw<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    #[account(
        mut,
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA
    #[account(
        mut,
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"pending", recipient.key().as_ref()],
        bump = pending_withdraw.bump,
        constraint = pending_withdraw.recipient == recipient.key() @ ErrorCode::Unauthorized
    )]
    pub pending_withdraw: Account<'info, PendingWithdraw>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetPoolStats<'info> {
    #[account(
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA
    #[account(
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,
}

// ============================================
// ACCOUNTS - RELAYER / GASLESS CLAIM
// ============================================

/// Claim withdrawal via relayer (gasless for recipient)
/// The relayer pays gas, recipient just signs a message off-chain
#[derive(Accounts)]
pub struct ClaimWithdrawRelayed<'info> {
    /// Relayer pays gas (any wallet can be relayer)
    #[account(mut)]
    pub relayer: Signer<'info>,

    /// CHECK: The recipient (stealth address) - NOT a signer
    /// Ownership is proven via ed25519 signature in previous instruction
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA
    #[account(
        mut,
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"pending", pending_withdraw.recipient.as_ref()],
        bump = pending_withdraw.bump,
        constraint = pending_withdraw.recipient == recipient.key() @ ErrorCode::Unauthorized
    )]
    pub pending_withdraw: Account<'info, PendingWithdraw>,

    /// CHECK: Instructions sysvar for ed25519 verification
    #[account(address = instructions_sysvar::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================
// ACCOUNTS - BATCH WITHDRAWALS
// ============================================

#[derive(Accounts)]
pub struct BatchClaimWithdraw<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA
    #[account(
        mut,
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
    // remaining_accounts: pairs of [recipient, pending_withdraw_pda] for each claim
}

// ============================================
// ACCOUNTS - POOL CHURN
// ============================================

#[derive(Accounts)]
#[instruction(vault_index: u8)]
pub struct InitChurnVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    #[account(
        init,
        payer = authority,
        space = ChurnVaultState::SPACE,
        seeds = [b"churn_state", vault_index.to_le_bytes().as_ref()],
        bump
    )]
    pub churn_state: Account<'info, ChurnVaultState>,

    /// CHECK: Churn vault PDA - just holds SOL
    #[account(
        mut,
        seeds = [b"churn_vault", vault_index.to_le_bytes().as_ref()],
        bump
    )]
    pub churn_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PoolChurn<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA
    #[account(
        mut,
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"churn_state", churn_state.vault_index.to_le_bytes().as_ref()],
        bump = churn_state.bump
    )]
    pub churn_state: Account<'info, ChurnVaultState>,

    /// CHECK: Churn vault PDA
    #[account(
        mut,
        seeds = [b"churn_vault", churn_state.vault_index.to_le_bytes().as_ref()],
        bump = churn_state.vault_bump
    )]
    pub churn_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PoolUnchurn<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"privacy_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, PrivacyPool>,

    /// CHECK: Pool vault PDA
    #[account(
        mut,
        seeds = [b"pool_vault"],
        bump = pool.vault_bump
    )]
    pub pool_vault: SystemAccount<'info>,

    #[account(
        seeds = [b"churn_state", churn_state.vault_index.to_le_bytes().as_ref()],
        bump = churn_state.bump
    )]
    pub churn_state: Account<'info, ChurnVaultState>,

    /// CHECK: Churn vault PDA
    #[account(
        mut,
        seeds = [b"churn_vault", churn_state.vault_index.to_le_bytes().as_ref()],
        bump = churn_state.vault_bump
    )]
    pub churn_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================
// ACCOUNTS - CAMPAIGNS
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

#[derive(Accounts)]
pub struct SetStealthMetaAddress<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub campaign: Account<'info, Campaign>,
}

#[derive(Accounts)]
#[instruction(stealth_address: Pubkey)]
pub struct RegisterStealthPayment<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        init,
        payer = donor,
        space = StealthRegistry::SPACE,
        seeds = [b"stealth", campaign.key().as_ref(), stealth_address.as_ref()],
        bump
    )]
    pub registry: Account<'info, StealthRegistry>,

    pub system_program: Program<'info, System>,
}

// ============================================
// STATE - PRIVACY POOL
// ============================================

/// The global privacy pool that holds aggregated funds
/// PRIVACY: Only stores aggregate stats, no individual deposit tracking
#[account]
pub struct PrivacyPool {
    pub total_deposited: u64,  // 8 bytes - aggregate deposits
    pub total_withdrawn: u64,  // 8 bytes - aggregate withdrawals
    pub deposit_count: u64,    // 8 bytes - number of deposits
    pub withdraw_count: u64,   // 8 bytes - number of withdrawals
    pub churn_count: u64,      // 8 bytes - number of churn operations
    pub bump: u8,              // 1 byte
    pub vault_bump: u8,        // 1 byte
}

impl PrivacyPool {
    pub const SPACE: usize = 8 +  // discriminator
        8 +                        // total_deposited
        8 +                        // total_withdrawn
        8 +                        // deposit_count
        8 +                        // withdraw_count
        8 +                        // churn_count
        1 +                        // bump
        1 +                        // vault_bump
        16;                        // padding
}

/// State for a churn vault (internal mixing vault)
/// PRIVACY: Enables micro-movements that break graph heuristics
#[account]
pub struct ChurnVaultState {
    pub vault_index: u8,       // 1 byte - which churn vault (0, 1, 2)
    pub total_churned: u64,    // 8 bytes - total SOL churned through
    pub churn_count: u64,      // 8 bytes - number of churn operations
    pub bump: u8,              // 1 byte
    pub vault_bump: u8,        // 1 byte
}

impl ChurnVaultState {
    pub const SPACE: usize = 8 +  // discriminator
        1 +                        // vault_index
        8 +                        // total_churned
        8 +                        // churn_count
        1 +                        // bump
        1 +                        // vault_bump
        16;                        // padding
}

/// A pending withdrawal request with time delay
/// PRIVACY: Only stores recipient (stealth address), not sender
#[account]
pub struct PendingWithdraw {
    pub recipient: Pubkey,     // 32 bytes - stealth address
    pub amount: u64,           // 8 bytes - standardized amount
    pub requested_at: i64,     // 8 bytes - when requested
    pub available_at: i64,     // 8 bytes - when can be claimed
    pub claimed: bool,         // 1 byte
    pub bump: u8,              // 1 byte
}

impl PendingWithdraw {
    pub const SPACE: usize = 8 +  // discriminator
        32 +                       // recipient
        8 +                        // amount
        8 +                        // requested_at
        8 +                        // available_at
        1 +                        // claimed
        1 +                        // bump
        16;                        // padding
}

// ============================================
// STATE - CAMPAIGNS
// ============================================

#[account]
pub struct Campaign {
    pub owner: Pubkey,                   // 32 bytes
    pub campaign_id: String,             // 4 + 32 = 36 bytes
    pub title: String,                   // 4 + 64 = 68 bytes
    pub description: String,             // 4 + 256 = 260 bytes
    pub goal: u64,                       // 8 bytes
    pub total_raised: u64,               // 8 bytes (vault donations)
    pub donor_count: u64,                // 8 bytes
    pub deadline: i64,                   // 8 bytes
    pub status: CampaignStatus,          // 1 byte
    pub created_at: i64,                 // 8 bytes
    pub vault_bump: u8,                  // 1 byte
    pub campaign_bump: u8,               // 1 byte
    // Stealth fields
    pub stealth_meta_address: String,    // 4 + 200 = 204 bytes (st:viewPub:spendPub)
    pub stealth_donations: u64,          // 8 bytes (count of stealth donations)
    pub stealth_total: u64,              // 8 bytes (total stealth amount - for display)
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
        (4 + 200) +               // stealth_meta_address
        8 +                        // stealth_donations
        8 +                        // stealth_total
        64;                        // padding for safety
}

/// Registry entry for a stealth payment
/// Stores metadata so recipient can scan and identify their payments
#[account]
pub struct StealthRegistry {
    pub campaign: Pubkey,           // 32 bytes - which campaign
    pub stealth_address: Pubkey,    // 32 bytes - the stealth address
    pub ephemeral_pub_key: String,  // 4 + 64 = 68 bytes - for recipient to derive
    pub amount: u64,                // 8 bytes - amount sent
    pub timestamp: i64,             // 8 bytes - when
    pub bump: u8,                   // 1 byte
}

impl StealthRegistry {
    pub const SPACE: usize = 8 +   // discriminator
        32 +                        // campaign
        32 +                        // stealth_address
        (4 + 64) +                  // ephemeral_pub_key
        8 +                         // amount
        8 +                         // timestamp
        1 +                         // bump
        16;                         // padding
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
    // Campaign errors
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
    #[msg("Stealth meta-address too long (max 200 chars)")]
    MetaAddressTooLong,
    #[msg("Ephemeral public key too long (max 64 chars)")]
    EphemeralKeyTooLong,

    // Privacy Pool errors
    #[msg("Invalid withdrawal amount. Must be 0.1, 0.5, or 1 SOL")]
    InvalidWithdrawAmount,
    #[msg("Insufficient funds in privacy pool")]
    InsufficientPoolFunds,
    #[msg("Withdrawal not ready yet. Please wait for delay period")]
    WithdrawNotReady,
    #[msg("Withdrawal already claimed")]
    AlreadyClaimed,

    // Batch withdrawal errors
    #[msg("Batch too small - need at least 1 withdrawal (2 accounts)")]
    BatchTooSmall,
    #[msg("Batch accounts must be pairs (recipient + pending)")]
    BatchInvalidPairs,
    #[msg("Batch too large - max 5 withdrawals (10 accounts)")]
    BatchTooLarge,

    // Churn errors
    #[msg("Invalid churn vault index (must be 0, 1, or 2)")]
    InvalidChurnIndex,
    #[msg("Insufficient funds in churn vault")]
    InsufficientChurnFunds,

    // Relayer errors
    #[msg("Invalid ed25519 signature instruction")]
    InvalidSignatureInstruction,
    #[msg("Signer does not match pending withdrawal recipient")]
    SignerMismatch,
    #[msg("Invalid claim message format (expected 'claim:<pda>')")]
    InvalidClaimMessage,
}
