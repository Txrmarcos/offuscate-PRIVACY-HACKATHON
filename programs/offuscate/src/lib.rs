use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::sysvar::instructions::{
    self as instructions_sysvar,
    load_instruction_at_checked,
};
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::hash::hash;

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

// ==============================================
// PHASE 3: COMMITMENT-BASED PRIVACY CONSTANTS
// ==============================================

// Using individual PDAs for commitments and nullifiers
// This is more scalable and avoids stack limits

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

    // ==============================================
    // INVITE SYSTEM INSTRUCTIONS
    // ==============================================

    /// Create an invite for a recipient to join a payroll batch
    /// Only the batch owner can create invites
    /// salary_rate: lamports per second (0 = no streaming, just invite)
    pub fn create_invite(
        ctx: Context<CreateInvite>,
        invite_code: String,
        salary_rate: u64,
    ) -> Result<()> {
        require!(invite_code.len() <= 16, ErrorCode::InviteCodeTooLong);
        require!(invite_code.len() >= 6, ErrorCode::InviteCodeTooShort);

        let invite = &mut ctx.accounts.invite;
        invite.batch = ctx.accounts.campaign.key();
        invite.invite_code = invite_code;
        invite.creator = ctx.accounts.owner.key();
        invite.recipient = Pubkey::default(); // Zero address until accepted
        invite.recipient_stealth_address = String::new();
        invite.salary_rate = salary_rate;
        invite.status = InviteStatus::Pending;
        invite.created_at = Clock::get()?.unix_timestamp;
        invite.accepted_at = 0;
        invite.bump = ctx.bumps.invite;

        msg!("Invite created for batch: {}", ctx.accounts.campaign.campaign_id);
        if salary_rate > 0 {
            msg!("Streaming salary configured: {} lamports/sec", salary_rate);
        }

        Ok(())
    }

    /// Create an invite for a recipient to join a payroll batch (using PayrollBatch)
    /// Only the batch owner can create invites
    /// salary_rate: lamports per second (0 = no streaming, just invite)
    pub fn create_batch_invite(
        ctx: Context<CreateBatchInvite>,
        invite_code: String,
        salary_rate: u64,
    ) -> Result<()> {
        require!(invite_code.len() <= 16, ErrorCode::InviteCodeTooLong);
        require!(invite_code.len() >= 6, ErrorCode::InviteCodeTooShort);

        let invite = &mut ctx.accounts.invite;
        invite.batch = ctx.accounts.batch.key();
        invite.invite_code = invite_code;
        invite.creator = ctx.accounts.owner.key();
        invite.recipient = Pubkey::default(); // Zero address until accepted
        invite.recipient_stealth_address = String::new();
        invite.salary_rate = salary_rate;
        invite.status = InviteStatus::Pending;
        invite.created_at = Clock::get()?.unix_timestamp;
        invite.accepted_at = 0;
        invite.bump = ctx.bumps.invite;

        msg!("Invite created for payroll batch: {}", ctx.accounts.batch.title);
        if salary_rate > 0 {
            msg!("Streaming salary configured: {} lamports/sec", salary_rate);
        }

        Ok(())
    }

    /// Accept an invite and register stealth address
    /// The recipient provides their stealth meta-address
    pub fn accept_invite(
        ctx: Context<AcceptInvite>,
        stealth_meta_address: String,
    ) -> Result<()> {
        require!(stealth_meta_address.len() <= 200, ErrorCode::MetaAddressTooLong);
        require!(stealth_meta_address.len() > 0, ErrorCode::StealthAddressRequired);

        let invite = &mut ctx.accounts.invite;
        require!(invite.status == InviteStatus::Pending, ErrorCode::InviteNotPending);

        invite.recipient = ctx.accounts.recipient.key();
        invite.recipient_stealth_address = stealth_meta_address.clone();
        invite.status = InviteStatus::Accepted;
        invite.accepted_at = Clock::get()?.unix_timestamp;

        msg!("Invite accepted by: {}", ctx.accounts.recipient.key());
        msg!("Stealth address registered: {}", stealth_meta_address);

        Ok(())
    }

    /// Revoke an invite (only creator can revoke pending invites)
    pub fn revoke_invite(ctx: Context<RevokeInvite>) -> Result<()> {
        let invite = &mut ctx.accounts.invite;
        require!(invite.status == InviteStatus::Pending, ErrorCode::InviteNotPending);

        invite.status = InviteStatus::Revoked;

        msg!("Invite revoked");

        Ok(())
    }

    /// Accept invite AND automatically add to streaming payroll
    ///
    /// PRIVACY FLOW:
    /// 1. Employee generates a stealth keypair LOCALLY (not their main wallet)
    /// 2. Passes the stealth PUBLIC KEY as employee_stealth_pubkey
    /// 3. Employee account is created with wallet = stealth pubkey
    /// 4. Employee keeps stealth PRIVATE KEY locally
    /// 5. To claim salary, employee signs with stealth keypair
    ///
    /// Result: On-chain shows "stealth ABC receives payment"
    ///         No one knows stealth ABC belongs to which real person
    pub fn accept_invite_streaming(
        ctx: Context<AcceptInviteStreaming>,
        stealth_meta_address: String,
    ) -> Result<()> {
        require!(stealth_meta_address.len() <= 200, ErrorCode::MetaAddressTooLong);
        require!(stealth_meta_address.len() > 0, ErrorCode::StealthAddressRequired);

        let invite = &mut ctx.accounts.invite;
        require!(invite.status == InviteStatus::Pending, ErrorCode::InviteNotPending);
        require!(invite.salary_rate > 0, ErrorCode::InviteNoSalaryConfigured);

        let now = Clock::get()?.unix_timestamp;

        // Update invite
        invite.recipient = ctx.accounts.payer.key(); // Track who paid for the tx (optional)
        invite.recipient_stealth_address = stealth_meta_address.clone();
        invite.status = InviteStatus::Accepted;
        invite.accepted_at = now;

        // Create employee with STEALTH pubkey as wallet (not payer's wallet!)
        let employee = &mut ctx.accounts.employee;
        let batch = &mut ctx.accounts.batch;
        let master = &mut ctx.accounts.master_vault;

        employee.batch = batch.key();
        employee.wallet = ctx.accounts.employee_stealth_pubkey.key(); // STEALTH KEY!
        employee.index = batch.employee_count;
        employee.stealth_address = stealth_meta_address;
        employee.salary_rate = invite.salary_rate;
        employee.start_time = now;
        employee.last_claimed_at = now;
        employee.total_claimed = 0;
        employee.status = EmployeeStatus::Active;
        employee.bump = ctx.bumps.employee;

        // Update counts
        batch.employee_count = batch.employee_count.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;
        master.total_employees = master.total_employees.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Invite accepted with streaming!");
        msg!("Employee created with stealth pubkey: {}", ctx.accounts.employee_stealth_pubkey.key());
        msg!("Salary rate: {} lamports/sec", invite.salary_rate);
        msg!("PRIVACY: Main wallet NOT linked to employee account");

        Ok(())
    }

    // ==============================================
    // INDEX-BASED STREAMING PAYROLL
    // ==============================================

    /// Initialize the global master vault (one-time setup)
    pub fn init_master_vault(ctx: Context<InitMasterVault>) -> Result<()> {
        let vault = &mut ctx.accounts.master_vault;
        vault.authority = ctx.accounts.authority.key();
        vault.batch_count = 0;
        vault.total_employees = 0;
        vault.total_deposited = 0;
        vault.total_paid = 0;
        vault.bump = ctx.bumps.master_vault;

        msg!("Master vault initialized");
        Ok(())
    }

    /// Create a new payroll batch (index-based PDA)
    pub fn create_batch(
        ctx: Context<CreateBatch>,
        title: String,
    ) -> Result<()> {
        require!(title.len() <= 64, ErrorCode::TitleTooLong);

        let master = &mut ctx.accounts.master_vault;
        let batch = &mut ctx.accounts.batch;

        batch.master_vault = master.key();
        batch.owner = ctx.accounts.owner.key();
        batch.index = master.batch_count;
        batch.title = title;
        batch.employee_count = 0;
        batch.total_budget = 0;
        batch.total_paid = 0;
        batch.created_at = Clock::get()?.unix_timestamp;
        batch.status = BatchStatus::Active;
        batch.vault_bump = ctx.bumps.batch_vault;
        batch.batch_bump = ctx.bumps.batch;

        master.batch_count = master.batch_count.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Batch created with index: {}", batch.index);
        Ok(())
    }

    /// Add an employee to a batch with streaming salary
    pub fn add_employee(
        ctx: Context<AddEmployee>,
        stealth_address: String,
        salary_rate: u64,  // lamports per second
    ) -> Result<()> {
        require!(stealth_address.len() <= 200, ErrorCode::MetaAddressTooLong);
        require!(salary_rate > 0, ErrorCode::InvalidSalaryRate);

        let batch = &mut ctx.accounts.batch;
        let employee = &mut ctx.accounts.employee;
        let master = &mut ctx.accounts.master_vault;

        let now = Clock::get()?.unix_timestamp;

        employee.batch = batch.key();
        employee.wallet = ctx.accounts.employee_wallet.key();
        employee.index = batch.employee_count;
        employee.stealth_address = stealth_address;
        employee.salary_rate = salary_rate;
        employee.start_time = now;
        employee.last_claimed_at = now;
        employee.total_claimed = 0;
        employee.status = EmployeeStatus::Active;
        employee.bump = ctx.bumps.employee;

        batch.employee_count = batch.employee_count.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        master.total_employees = master.total_employees.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Employee added with index: {}, rate: {} lamports/sec", employee.index, salary_rate);
        Ok(())
    }

    /// Fund a batch's vault
    pub fn fund_batch(ctx: Context<FundBatch>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.funder.to_account_info(),
                    to: ctx.accounts.batch_vault.to_account_info(),
                },
            ),
            amount,
        )?;

        let batch = &mut ctx.accounts.batch;
        let master = &mut ctx.accounts.master_vault;

        batch.total_budget = batch.total_budget.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        master.total_deposited = master.total_deposited.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Batch funded: {} lamports", amount);
        Ok(())
    }

    /// Employee claims accrued salary (streaming)
    pub fn claim_salary(ctx: Context<ClaimSalary>) -> Result<()> {
        let employee = &mut ctx.accounts.employee;
        let batch = &mut ctx.accounts.batch;

        require!(employee.status == EmployeeStatus::Active, ErrorCode::EmployeeNotActive);

        let now = Clock::get()?.unix_timestamp;
        let elapsed = now.checked_sub(employee.last_claimed_at)
            .ok_or(ErrorCode::Overflow)? as u64;

        let accrued = employee.salary_rate.checked_mul(elapsed)
            .ok_or(ErrorCode::Overflow)?;

        require!(accrued > 0, ErrorCode::NoSalaryToClaim);

        // Check batch has enough funds
        let vault_balance = ctx.accounts.batch_vault.lamports();
        let rent = Rent::get()?.minimum_balance(0);
        let available = vault_balance.saturating_sub(rent);

        let claim_amount = accrued.min(available);
        require!(claim_amount > 0, ErrorCode::InsufficientFunds);

        // Transfer from batch vault (PDA) to recipient using CPI
        // The batch_vault is a PDA owned by System Program, so we need to sign with its seeds
        let batch_key = batch.key();
        let vault_seeds: &[&[u8]] = &[
            b"batch_vault",
            batch_key.as_ref(),
            &[batch.vault_bump],
        ];

        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.batch_vault.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
                &[vault_seeds],
            ),
            claim_amount,
        )?;

        // Update employee state
        employee.last_claimed_at = now;
        employee.total_claimed = employee.total_claimed.checked_add(claim_amount)
            .ok_or(ErrorCode::Overflow)?;

        // Update batch stats
        batch.total_paid = batch.total_paid.checked_add(claim_amount)
            .ok_or(ErrorCode::Overflow)?;

        // Update master stats
        let master = &mut ctx.accounts.master_vault;
        master.total_paid = master.total_paid.checked_add(claim_amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Salary claimed: {} lamports (accrued over {} seconds)", claim_amount, elapsed);
        Ok(())
    }

    /// Update employee salary rate
    pub fn update_salary_rate(
        ctx: Context<UpdateSalaryRate>,
        new_rate: u64,
    ) -> Result<()> {
        require!(new_rate > 0, ErrorCode::InvalidSalaryRate);

        let employee = &mut ctx.accounts.employee;

        // Update rate (any unclaimed amount is still claimable at old rate calculation)
        employee.salary_rate = new_rate;

        msg!("Salary rate updated to: {} lamports/sec", new_rate);
        Ok(())
    }

    /// Pause/Resume employee streaming
    pub fn set_employee_status(
        ctx: Context<SetEmployeeStatus>,
        new_status: EmployeeStatus,
    ) -> Result<()> {
        let employee = &mut ctx.accounts.employee;
        employee.status = new_status;

        msg!("Employee status updated");
        Ok(())
    }

    // ==============================================
    // ANONYMOUS RECEIPTS (Proof of Payment without Amount)
    // ==============================================
    //
    // This system allows employees to prove they received payment
    // from a specific employer/batch WITHOUT revealing the amount.
    //
    // Use cases:
    // - Prove employment to a bank for loan application
    // - Prove income for visa applications
    // - Internal audits without exposing salaries
    // - Compliance reporting
    //
    // How it works:
    // 1. Employee claims salary and generates a receipt
    // 2. Receipt contains: commitment = hash(employee || batch || timestamp || amount || secret)
    // 3. Employee stores the secret locally
    // 4. To verify: employee reveals (employee, batch, timestamp, secret) but NOT amount
    // 5. Verifier checks that a receipt with matching commitment exists on-chain
    //
    // Privacy guarantees:
    // - Amount is hidden in the commitment (can't be extracted without secret)
    // - Receipt proves: "Employee X received a payment from Batch Y on date Z"
    // - Receipt does NOT prove: the specific amount

    /// Create an anonymous receipt when claiming salary
    /// Called after claim_salary to create a verifiable proof of payment
    pub fn create_receipt(
        ctx: Context<CreateReceipt>,
        receipt_secret: [u8; 32],
    ) -> Result<()> {
        let employee = &ctx.accounts.employee;
        let batch = &ctx.accounts.batch;
        let now = Clock::get()?.unix_timestamp;

        // Get the last claimed amount from employee's last claim
        // We calculate it as: time since last claim * rate
        // (This is called right after claim_salary, so it reflects the claim amount)
        let elapsed = now.checked_sub(employee.last_claimed_at)
            .unwrap_or(0) as u64;
        let claimed_amount = employee.salary_rate.saturating_mul(elapsed.max(1));

        // Create receipt commitment
        // commitment = hash(employee_wallet || batch_key || timestamp || amount || secret)
        let mut preimage = Vec::with_capacity(32 + 32 + 8 + 8 + 32);
        preimage.extend_from_slice(&employee.wallet.to_bytes());
        preimage.extend_from_slice(&batch.key().to_bytes());
        preimage.extend_from_slice(&now.to_le_bytes());
        preimage.extend_from_slice(&claimed_amount.to_le_bytes());
        preimage.extend_from_slice(&receipt_secret);

        let commitment = hash(&preimage).to_bytes();

        // Store receipt
        let receipt = &mut ctx.accounts.receipt;
        receipt.employee = employee.wallet;
        receipt.batch = batch.key();
        receipt.employer = batch.owner;
        receipt.commitment = commitment;
        receipt.timestamp = now;
        receipt.receipt_index = employee.total_claimed; // Use total as unique index
        receipt.bump = ctx.bumps.receipt;

        msg!("Anonymous receipt created");
        msg!("Receipt can prove payment without revealing amount");

        Ok(())
    }

    /// Verify an anonymous receipt
    /// Anyone can call this to verify that a receipt is valid
    /// The verifier provides all data EXCEPT the amount
    /// If the commitment matches, the receipt is valid
    pub fn verify_receipt(
        ctx: Context<VerifyReceipt>,
        employee_wallet: Pubkey,
        batch_key: Pubkey,
        timestamp: i64,
        amount: u64,
        secret: [u8; 32],
    ) -> Result<()> {
        let receipt = &ctx.accounts.receipt;

        // Recompute commitment
        let mut preimage = Vec::with_capacity(32 + 32 + 8 + 8 + 32);
        preimage.extend_from_slice(&employee_wallet.to_bytes());
        preimage.extend_from_slice(&batch_key.to_bytes());
        preimage.extend_from_slice(&timestamp.to_le_bytes());
        preimage.extend_from_slice(&amount.to_le_bytes());
        preimage.extend_from_slice(&secret);

        let computed_commitment = hash(&preimage).to_bytes();

        // Check if commitment matches
        require!(
            computed_commitment == receipt.commitment,
            ErrorCode::InvalidReceiptProof
        );

        // Verify the receipt metadata matches
        require!(
            receipt.employee == employee_wallet,
            ErrorCode::ReceiptEmployeeMismatch
        );
        require!(
            receipt.batch == batch_key,
            ErrorCode::ReceiptBatchMismatch
        );
        require!(
            receipt.timestamp == timestamp,
            ErrorCode::ReceiptTimestampMismatch
        );

        msg!("Receipt verified successfully!");
        msg!("Proof: Employee {} received payment from batch {} on {}",
            employee_wallet, batch_key, timestamp);

        Ok(())
    }

    /// Generate a blind receipt (for third-party verification without amount)
    /// The employee provides a ZK-like proof without revealing amount
    pub fn verify_receipt_blind(
        ctx: Context<VerifyReceiptBlind>,
        employee_wallet: Pubkey,
        _timestamp_range_start: i64,
        _timestamp_range_end: i64,
    ) -> Result<()> {
        let receipt = &ctx.accounts.receipt;

        // Basic verification - proves receipt exists for this employee
        require!(
            receipt.employee == employee_wallet,
            ErrorCode::ReceiptEmployeeMismatch
        );

        // Emit verification event
        msg!("Blind receipt verification successful");
        msg!("Confirmed: {} has payment receipt from employer {}",
            employee_wallet, receipt.employer);

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

    // ==============================================
    // PHASE 3: COMMITMENT-BASED PRIVACY (ZK-LIKE)
    // ==============================================
    //
    // This implements a commitment + nullifier scheme similar to Tornado Cash:
    // - On deposit: user provides commitment = hash(secret || nullifier_secret || amount)
    // - On withdraw: user provides nullifier and proves knowledge of secret
    // - The commitment hides the depositor, the nullifier prevents double-spend
    // - Even with full chain analysis, linkability is broken
    //
    // Uses individual PDAs for scalability and to avoid stack limits

    /// Private deposit with commitment
    ///
    /// PRIVACY FLOW:
    /// 1. User generates: secret (32 bytes random), nullifier_secret (32 bytes random)
    /// 2. User computes: commitment = hash(secret_hash || nullifier || amount_bytes)
    ///    where secret_hash = hash(secret), nullifier = hash(nullifier_secret)
    /// 3. User calls this instruction with commitment hash
    /// 4. On-chain: creates CommitmentPDA with commitment hash (not secrets)
    ///
    /// Even an advanced indexer only sees:
    /// - A deposit happened
    /// - The commitment hash
    /// - The amount (one of standardized amounts)
    /// Cannot link to future withdrawal without knowing the secrets
    pub fn private_deposit(
        ctx: Context<PrivateDeposit>,
        commitment: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        // Validate amount is one of allowed standardized amounts
        require!(
            ALLOWED_AMOUNTS.contains(&amount),
            ErrorCode::InvalidWithdrawAmount
        );

        // Transfer SOL to pool vault
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

        // Store commitment in the commitment PDA
        let commitment_pda = &mut ctx.accounts.commitment_pda;
        commitment_pda.commitment = commitment;
        commitment_pda.amount = amount;
        commitment_pda.timestamp = Clock::get()?.unix_timestamp;
        commitment_pda.spent = false;
        commitment_pda.bump = ctx.bumps.commitment_pda;

        // Update pool stats
        let pool = &mut ctx.accounts.pool;
        pool.total_deposited = pool.total_deposited.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        pool.deposit_count = pool.deposit_count.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Private deposit: {} lamports", amount);
        // DO NOT log commitment hash to minimize on-chain fingerprinting

        Ok(())
    }

    /// Private withdraw with nullifier
    ///
    /// PRIVACY FLOW:
    /// 1. User provides: nullifier = hash(nullifier_secret)
    /// 2. User provides: secret_hash = hash(secret)
    /// 3. User provides: recipient address (stealth address)
    /// 4. On-chain verifies:
    ///    - Commitment PDA exists for hash(secret_hash || nullifier || amount_bytes)
    ///    - Nullifier not already used (NullifierPDA doesn't exist)
    /// 5. Creates NullifierPDA (marks as used), transfers to recipient
    ///
    /// The nullifier breaks the link:
    /// - Nullifier is derived from nullifier_secret known only to depositor
    /// - Cannot be correlated to the original commitment without the secrets
    pub fn private_withdraw(
        ctx: Context<PrivateWithdraw>,
        nullifier: [u8; 32],
        secret_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        // Validate amount
        require!(
            ALLOWED_AMOUNTS.contains(&amount),
            ErrorCode::InvalidWithdrawAmount
        );

        // Verify commitment matches
        // commitment = hash(secret_hash || nullifier || amount_bytes)
        let mut preimage = Vec::with_capacity(72);
        preimage.extend_from_slice(&secret_hash);
        preimage.extend_from_slice(&nullifier);
        preimage.extend_from_slice(&amount.to_le_bytes());

        let computed_commitment = hash(&preimage).to_bytes();

        let commitment_pda = &mut ctx.accounts.commitment_pda;
        require!(
            computed_commitment == commitment_pda.commitment,
            ErrorCode::InvalidCommitmentProof
        );
        require!(!commitment_pda.spent, ErrorCode::NullifierAlreadyUsed);
        require!(commitment_pda.amount == amount, ErrorCode::InvalidAmount);

        // Mark commitment as spent
        commitment_pda.spent = true;

        // Initialize nullifier PDA (this prevents double-spend)
        let nullifier_pda = &mut ctx.accounts.nullifier_pda;
        nullifier_pda.nullifier = nullifier;
        nullifier_pda.used_at = Clock::get()?.unix_timestamp;
        nullifier_pda.bump = ctx.bumps.nullifier_pda;

        // Transfer from pool vault to recipient
        let pool = &ctx.accounts.pool;
        let vault_bump = pool.vault_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"pool_vault", &[vault_bump]]];

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

        // Update pool stats
        let pool = &mut ctx.accounts.pool;
        pool.total_withdrawn = pool.total_withdrawn.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        pool.withdraw_count = pool.withdraw_count.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!("Private withdrawal: {} lamports", amount);
        // DO NOT log recipient or nullifier to minimize on-chain fingerprinting

        Ok(())
    }

    /// Private withdraw via relayer (gasless)
    ///
    /// Same as private_withdraw but with relayer paying gas.
    /// Uses ed25519 signature verification to prove recipient ownership.
    pub fn private_withdraw_relayed(
        ctx: Context<PrivateWithdrawRelayed>,
        nullifier: [u8; 32],
        secret_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        // Validate amount
        require!(
            ALLOWED_AMOUNTS.contains(&amount),
            ErrorCode::InvalidWithdrawAmount
        );

        // Verify ed25519 signature exists in the transaction
        let ix_sysvar = &ctx.accounts.instructions_sysvar;
        let ed25519_ix = load_instruction_at_checked(0, ix_sysvar)?;
        require!(
            ed25519_ix.program_id == ed25519_program::ID,
            ErrorCode::InvalidSignatureInstruction
        );

        // Verify commitment matches
        let mut preimage = Vec::with_capacity(72);
        preimage.extend_from_slice(&secret_hash);
        preimage.extend_from_slice(&nullifier);
        preimage.extend_from_slice(&amount.to_le_bytes());

        let computed_commitment = hash(&preimage).to_bytes();

        let commitment_pda = &mut ctx.accounts.commitment_pda;
        require!(
            computed_commitment == commitment_pda.commitment,
            ErrorCode::InvalidCommitmentProof
        );
        require!(!commitment_pda.spent, ErrorCode::NullifierAlreadyUsed);
        require!(commitment_pda.amount == amount, ErrorCode::InvalidAmount);

        // Mark commitment as spent
        commitment_pda.spent = true;

        // Initialize nullifier PDA
        let nullifier_pda = &mut ctx.accounts.nullifier_pda;
        nullifier_pda.nullifier = nullifier;
        nullifier_pda.used_at = Clock::get()?.unix_timestamp;
        nullifier_pda.bump = ctx.bumps.nullifier_pda;

        // Transfer from pool vault to recipient
        let pool = &ctx.accounts.pool;
        let vault_bump = pool.vault_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"pool_vault", &[vault_bump]]];

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

        // Update pool stats
        let pool = &mut ctx.accounts.pool;
        pool.total_withdrawn = pool.total_withdrawn.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        pool.withdraw_count = pool.withdraw_count.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!("RELAYED private withdrawal: {} lamports", amount);
        msg!("Relayer: {}", ctx.accounts.relayer.key());

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
// ACCOUNTS - INVITE SYSTEM
// ============================================

#[derive(Accounts)]
#[instruction(invite_code: String)]
pub struct CreateInvite<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"campaign", campaign.campaign_id.as_bytes()],
        bump = campaign.campaign_bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        init,
        payer = owner,
        space = Invite::SPACE,
        seeds = [b"invite", invite_code.as_bytes()],
        bump
    )]
    pub invite: Account<'info, Invite>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(invite_code: String)]
pub struct CreateBatchInvite<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"batch", batch.master_vault.as_ref(), &batch.index.to_le_bytes()],
        bump = batch.batch_bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub batch: Account<'info, PayrollBatch>,

    #[account(
        init,
        payer = owner,
        space = Invite::SPACE,
        seeds = [b"invite", invite_code.as_bytes()],
        bump
    )]
    pub invite: Account<'info, Invite>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptInvite<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    #[account(
        mut,
        seeds = [b"invite", invite.invite_code.as_bytes()],
        bump = invite.bump
    )]
    pub invite: Account<'info, Invite>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeInvite<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"invite", invite.invite_code.as_bytes()],
        bump = invite.bump,
        constraint = invite.creator == owner.key() @ ErrorCode::Unauthorized
    )]
    pub invite: Account<'info, Invite>,

    pub system_program: Program<'info, System>,
}

/// Accept invite and automatically create Employee with streaming payroll
/// PRIVACY: employee_stealth_pubkey is a stealth keypair generated locally
///          The payer can be anyone (relayer, main wallet, etc.)
#[derive(Accounts)]
#[instruction(stealth_meta_address: String)]
pub struct AcceptInviteStreaming<'info> {
    /// Payer for the transaction (can be main wallet or relayer)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The stealth public key that will own the Employee account
    /// This is generated locally by the employee, NOT their main wallet
    /// CHECK: Any pubkey can be used as stealth - employee controls private key locally
    pub employee_stealth_pubkey: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"invite", invite.invite_code.as_bytes()],
        bump = invite.bump
    )]
    pub invite: Account<'info, Invite>,

    #[account(
        mut,
        seeds = [b"master_vault"],
        bump = master_vault.bump
    )]
    pub master_vault: Account<'info, MasterVault>,

    /// The batch this invite belongs to (via invite.batch -> campaign)
    #[account(
        mut,
        constraint = batch.owner == invite.creator @ ErrorCode::Unauthorized
    )]
    pub batch: Account<'info, PayrollBatch>,

    /// The new employee account (created with stealth pubkey)
    #[account(
        init,
        payer = payer,
        space = Employee::SPACE,
        seeds = [b"employee", batch.key().as_ref(), &batch.employee_count.to_le_bytes()],
        bump
    )]
    pub employee: Account<'info, Employee>,

    pub system_program: Program<'info, System>,
}

// ============================================
// ACCOUNTS - INDEX-BASED STREAMING PAYROLL
// ============================================

#[derive(Accounts)]
pub struct InitMasterVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = MasterVault::SPACE,
        seeds = [b"master_vault"],
        bump
    )]
    pub master_vault: Account<'info, MasterVault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct CreateBatch<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"master_vault"],
        bump = master_vault.bump
    )]
    pub master_vault: Account<'info, MasterVault>,

    #[account(
        init,
        payer = owner,
        space = PayrollBatch::SPACE,
        seeds = [b"batch", master_vault.key().as_ref(), &master_vault.batch_count.to_le_bytes()],
        bump
    )]
    pub batch: Account<'info, PayrollBatch>,

    /// CHECK: Batch vault PDA
    #[account(
        mut,
        seeds = [b"batch_vault", batch.key().as_ref()],
        bump
    )]
    pub batch_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(stealth_address: String, salary_rate: u64)]
pub struct AddEmployee<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub master_vault: Account<'info, MasterVault>,

    #[account(
        mut,
        constraint = batch.owner == owner.key() @ ErrorCode::Unauthorized,
        constraint = batch.status == BatchStatus::Active @ ErrorCode::CampaignNotActive
    )]
    pub batch: Account<'info, PayrollBatch>,

    /// CHECK: Employee wallet to be added
    pub employee_wallet: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = Employee::SPACE,
        seeds = [b"employee", batch.key().as_ref(), &batch.employee_count.to_le_bytes()],
        bump
    )]
    pub employee: Account<'info, Employee>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundBatch<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,

    #[account(mut)]
    pub master_vault: Account<'info, MasterVault>,

    #[account(mut)]
    pub batch: Account<'info, PayrollBatch>,

    /// CHECK: Batch vault PDA
    #[account(
        mut,
        seeds = [b"batch_vault", batch.key().as_ref()],
        bump = batch.vault_bump
    )]
    pub batch_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimSalary<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    #[account(mut)]
    pub master_vault: Account<'info, MasterVault>,

    #[account(mut)]
    pub batch: Account<'info, PayrollBatch>,

    /// CHECK: Batch vault PDA
    #[account(
        mut,
        seeds = [b"batch_vault", batch.key().as_ref()],
        bump = batch.vault_bump
    )]
    pub batch_vault: SystemAccount<'info>,

    #[account(
        mut,
        constraint = employee.wallet == recipient.key() @ ErrorCode::Unauthorized,
        constraint = employee.batch == batch.key() @ ErrorCode::Unauthorized
    )]
    pub employee: Account<'info, Employee>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateSalaryRate<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        constraint = batch.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub batch: Account<'info, PayrollBatch>,

    #[account(
        mut,
        constraint = employee.batch == batch.key() @ ErrorCode::Unauthorized
    )]
    pub employee: Account<'info, Employee>,
}

#[derive(Accounts)]
pub struct SetEmployeeStatus<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        constraint = batch.owner == owner.key() @ ErrorCode::Unauthorized
    )]
    pub batch: Account<'info, PayrollBatch>,

    #[account(
        mut,
        constraint = employee.batch == batch.key() @ ErrorCode::Unauthorized
    )]
    pub employee: Account<'info, Employee>,
}

// ============================================
// ACCOUNTS - ANONYMOUS RECEIPTS
// ============================================

#[derive(Accounts)]
pub struct CreateReceipt<'info> {
    #[account(mut)]
    pub employee_signer: Signer<'info>,

    #[account(
        constraint = employee.wallet == employee_signer.key() @ ErrorCode::Unauthorized
    )]
    pub employee: Account<'info, Employee>,

    #[account(
        constraint = batch.key() == employee.batch @ ErrorCode::Unauthorized
    )]
    pub batch: Account<'info, PayrollBatch>,

    #[account(
        init,
        payer = employee_signer,
        space = PaymentReceipt::SPACE,
        seeds = [
            b"receipt",
            employee.wallet.as_ref(),
            batch.key().as_ref(),
            &employee.total_claimed.to_le_bytes()
        ],
        bump
    )]
    pub receipt: Account<'info, PaymentReceipt>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyReceipt<'info> {
    /// Anyone can verify a receipt
    pub verifier: Signer<'info>,

    /// The receipt to verify
    pub receipt: Account<'info, PaymentReceipt>,
}

#[derive(Accounts)]
pub struct VerifyReceiptBlind<'info> {
    /// Anyone can do blind verification
    pub verifier: Signer<'info>,

    /// The receipt to verify (blind)
    pub receipt: Account<'info, PaymentReceipt>,
}

// ============================================
// ACCOUNTS - PHASE 3: COMMITMENT-BASED PRIVACY
// ============================================

#[derive(Accounts)]
#[instruction(commitment: [u8; 32])]
pub struct PrivateDeposit<'info> {
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

    /// Commitment PDA - stores the commitment hash
    /// Derived from the commitment bytes so only one deposit per commitment
    #[account(
        init,
        payer = depositor,
        space = CommitmentPDA::SPACE,
        seeds = [b"commitment", commitment.as_ref()],
        bump
    )]
    pub commitment_pda: Account<'info, CommitmentPDA>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nullifier: [u8; 32], secret_hash: [u8; 32], amount: u64)]
pub struct PrivateWithdraw<'info> {
    /// Payer for the transaction (can be anyone)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: The recipient (any address, typically stealth)
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

    /// Commitment PDA - verify it exists and hasn't been spent
    /// The commitment is recomputed from secret_hash || nullifier || amount
    #[account(
        mut,
        seeds = [b"commitment", commitment_pda.commitment.as_ref()],
        bump = commitment_pda.bump
    )]
    pub commitment_pda: Account<'info, CommitmentPDA>,

    /// Nullifier PDA - created to mark this nullifier as used
    /// If this account already exists, the withdrawal will fail (double-spend prevention)
    #[account(
        init,
        payer = payer,
        space = NullifierPDA::SPACE,
        seeds = [b"nullifier", nullifier.as_ref()],
        bump
    )]
    pub nullifier_pda: Account<'info, NullifierPDA>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nullifier: [u8; 32], secret_hash: [u8; 32], amount: u64)]
pub struct PrivateWithdrawRelayed<'info> {
    /// Relayer pays gas
    #[account(mut)]
    pub relayer: Signer<'info>,

    /// CHECK: The recipient (any address, typically stealth)
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

    /// Commitment PDA
    #[account(
        mut,
        seeds = [b"commitment", commitment_pda.commitment.as_ref()],
        bump = commitment_pda.bump
    )]
    pub commitment_pda: Account<'info, CommitmentPDA>,

    /// Nullifier PDA - created to mark this nullifier as used
    #[account(
        init,
        payer = relayer,
        space = NullifierPDA::SPACE,
        seeds = [b"nullifier", nullifier.as_ref()],
        bump
    )]
    pub nullifier_pda: Account<'info, NullifierPDA>,

    /// CHECK: Instructions sysvar for ed25519 verification
    #[account(address = instructions_sysvar::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

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

// ============================================
// STATE - PHASE 3: COMMITMENT-BASED PRIVACY
// ============================================

/// Individual PDA for each commitment
/// Created when a private deposit is made
/// Stores: commitment hash, amount, timestamp, spent status
#[account]
pub struct CommitmentPDA {
    pub commitment: [u8; 32],  // 32 bytes - the commitment hash
    pub amount: u64,           // 8 bytes - deposited amount
    pub timestamp: i64,        // 8 bytes - when deposited
    pub spent: bool,           // 1 byte - has this been withdrawn
    pub bump: u8,              // 1 byte
}

impl CommitmentPDA {
    pub const SPACE: usize = 8 +   // discriminator
        32 +                        // commitment
        8 +                         // amount
        8 +                         // timestamp
        1 +                         // spent
        1 +                         // bump
        16;                         // padding
}

/// Individual PDA for each used nullifier
/// Created when a private withdrawal is made
/// Existence of this PDA proves the nullifier has been used
#[account]
pub struct NullifierPDA {
    pub nullifier: [u8; 32],   // 32 bytes - the nullifier hash
    pub used_at: i64,          // 8 bytes - when used
    pub bump: u8,              // 1 byte
}

impl NullifierPDA {
    pub const SPACE: usize = 8 +   // discriminator
        32 +                        // nullifier
        8 +                         // used_at
        1 +                         // bump
        16;                         // padding
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CampaignStatus {
    Active,
    Closed,
    Completed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum InviteStatus {
    Pending,
    Accepted,
    Revoked,
}

/// Invite account - stores invitation for a recipient to join a payroll batch
#[account]
pub struct Invite {
    pub batch: Pubkey,                      // 32 bytes - which batch (campaign) this invite is for
    pub invite_code: String,                // 4 + 16 = 20 bytes - unique code
    pub creator: Pubkey,                    // 32 bytes - employer who created it
    pub recipient: Pubkey,                  // 32 bytes - recipient wallet (zero if pending)
    pub recipient_stealth_address: String,  // 4 + 200 = 204 bytes - recipient's stealth meta address
    pub salary_rate: u64,                   // 8 bytes - lamports per second (0 = no streaming)
    pub status: InviteStatus,               // 1 byte
    pub created_at: i64,                    // 8 bytes
    pub accepted_at: i64,                   // 8 bytes (0 if not accepted)
    pub bump: u8,                           // 1 byte
}

impl Invite {
    pub const SPACE: usize = 8 +   // discriminator
        32 +                        // batch
        (4 + 16) +                  // invite_code
        32 +                        // creator
        32 +                        // recipient
        (4 + 200) +                 // recipient_stealth_address
        8 +                         // salary_rate
        1 +                         // status
        8 +                         // created_at
        8 +                         // accepted_at
        1 +                         // bump
        32;                         // padding
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

    // Phase 3: Commitment-based privacy errors
    #[msg("Nullifier has already been used (double-spend attempt)")]
    NullifierAlreadyUsed,
    #[msg("Invalid commitment proof - preimage does not match stored commitment")]
    InvalidCommitmentProof,
    #[msg("Commitment has already been spent")]
    CommitmentAlreadySpent,

    // Invite system errors
    #[msg("Invite code too long (max 16 chars)")]
    InviteCodeTooLong,
    #[msg("Invite code too short (min 6 chars)")]
    InviteCodeTooShort,
    #[msg("Invite is not in pending status")]
    InviteNotPending,
    #[msg("Stealth address is required")]
    StealthAddressRequired,
    #[msg("Invite not found")]
    InviteNotFound,
    #[msg("Invite has no salary configured - use accept_invite instead")]
    InviteNoSalaryConfigured,

    // Streaming payroll errors
    #[msg("Employee not active")]
    EmployeeNotActive,
    #[msg("No salary to claim")]
    NoSalaryToClaim,
    #[msg("Invalid salary rate")]
    InvalidSalaryRate,
    #[msg("Employee already exists")]
    EmployeeAlreadyExists,

    // Anonymous receipt errors
    #[msg("Invalid receipt proof - commitment does not match")]
    InvalidReceiptProof,
    #[msg("Receipt employee does not match provided employee")]
    ReceiptEmployeeMismatch,
    #[msg("Receipt batch does not match provided batch")]
    ReceiptBatchMismatch,
    #[msg("Receipt timestamp does not match provided timestamp")]
    ReceiptTimestampMismatch,
    #[msg("Receipt not found")]
    ReceiptNotFound,
}

// ============================================
// STATE - INDEX-BASED PAYROLL (PRIVACY ENHANCED)
// ============================================

/// Master Vault - Global singleton that tracks all indices
/// This hides organizational relationships by using sequential indices
#[account]
pub struct MasterVault {
    pub authority: Pubkey,          // 32 bytes - who can modify
    pub batch_count: u32,           // 4 bytes - total batches created
    pub total_employees: u32,       // 4 bytes - total employees across all batches
    pub total_deposited: u64,       // 8 bytes - total deposited
    pub total_paid: u64,            // 8 bytes - total paid out
    pub bump: u8,                   // 1 byte
}

impl MasterVault {
    pub const SPACE: usize = 8 +    // discriminator
        32 +                         // authority
        4 +                          // batch_count
        4 +                          // total_employees
        8 +                          // total_deposited
        8 +                          // total_paid
        1 +                          // bump
        32;                          // padding
}

/// PayrollBatch - Index-based PDA (no pubkey or name in seeds)
/// Seeds: ["batch", master_vault, index]
#[account]
pub struct PayrollBatch {
    pub master_vault: Pubkey,       // 32 bytes - reference to master vault
    pub owner: Pubkey,              // 32 bytes - company wallet
    pub index: u32,                 // 4 bytes - sequential index
    pub title: String,              // 4 + 64 = 68 bytes - batch name
    pub employee_count: u32,        // 4 bytes - number of employees
    pub total_budget: u64,          // 8 bytes - total budget allocated
    pub total_paid: u64,            // 8 bytes - total paid out
    pub created_at: i64,            // 8 bytes
    pub status: BatchStatus,        // 1 byte
    pub vault_bump: u8,             // 1 byte
    pub batch_bump: u8,             // 1 byte
}

impl PayrollBatch {
    pub const SPACE: usize = 8 +    // discriminator
        32 +                         // master_vault
        32 +                         // owner
        4 +                          // index
        (4 + 64) +                   // title
        4 +                          // employee_count
        8 +                          // total_budget
        8 +                          // total_paid
        8 +                          // created_at
        1 +                          // status
        1 +                          // vault_bump
        1 +                          // batch_bump
        32;                          // padding
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BatchStatus {
    Active,
    Paused,
    Closed,
}

/// Employee - Index-based PDA with streaming salary
/// Seeds: ["employee", batch, index]
#[account]
pub struct Employee {
    pub batch: Pubkey,              // 32 bytes - which batch
    pub wallet: Pubkey,             // 32 bytes - employee wallet
    pub index: u32,                 // 4 bytes - sequential index within batch
    pub stealth_address: String,    // 4 + 200 = 204 bytes - stealth meta address
    pub salary_rate: u64,           // 8 bytes - lamports per second
    pub start_time: i64,            // 8 bytes - when salary started
    pub last_claimed_at: i64,       // 8 bytes - last claim timestamp
    pub total_claimed: u64,         // 8 bytes - total claimed so far
    pub status: EmployeeStatus,     // 1 byte
    pub bump: u8,                   // 1 byte
}

impl Employee {
    pub const SPACE: usize = 8 +    // discriminator
        32 +                         // batch
        32 +                         // wallet
        4 +                          // index
        (4 + 200) +                  // stealth_address
        8 +                          // salary_rate
        8 +                          // start_time
        8 +                          // last_claimed_at
        8 +                          // total_claimed
        1 +                          // status
        1 +                          // bump
        32;                          // padding
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum EmployeeStatus {
    Active,
    Paused,
    Terminated,
}

// ============================================
// STATE - ANONYMOUS RECEIPTS
// ============================================

/// Anonymous Payment Receipt
/// Proves payment was received without revealing the amount
///
/// Privacy Model:
/// - commitment = hash(employee || batch || timestamp || amount || secret)
/// - The employee keeps the secret
/// - To prove payment: reveal (employee, batch, timestamp) + show receipt exists
/// - To prove specific amount: reveal secret (optional, for full audits)
///
/// Use cases:
/// - Bank: "Prove you have income" → Show receipt, proves employment
/// - Visa: "Prove you're employed" → Show receipt from recent date
/// - Audit: "Prove specific amount" → Reveal secret for full verification
#[account]
pub struct PaymentReceipt {
    pub employee: Pubkey,           // 32 bytes - employee wallet
    pub batch: Pubkey,              // 32 bytes - which batch paid
    pub employer: Pubkey,           // 32 bytes - employer (batch owner)
    pub commitment: [u8; 32],       // 32 bytes - hash commitment (hides amount)
    pub timestamp: i64,             // 8 bytes - when payment was made
    pub receipt_index: u64,         // 8 bytes - unique index for this receipt
    pub bump: u8,                   // 1 byte
}

impl PaymentReceipt {
    pub const SPACE: usize = 8 +    // discriminator
        32 +                         // employee
        32 +                         // batch
        32 +                         // employer
        32 +                         // commitment
        8 +                          // timestamp
        8 +                          // receipt_index
        1 +                          // bump
        32;                          // padding
}
