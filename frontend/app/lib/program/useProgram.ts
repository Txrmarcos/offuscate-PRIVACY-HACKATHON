'use client';

import { useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  createCampaignInstruction,
  donateInstruction,
  withdrawInstruction,
  closeCampaignInstruction,
  fetchCampaign,
  fetchVaultBalance,
  listCampaigns,
  getCampaignPDAs,
  PROGRAM_ID,
} from './client';

export function useProgram() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  // Send and confirm transaction
  const sendTx = useCallback(
    async (tx: Transaction) => {
      if (!publicKey || !signTransaction) {
        throw new Error('Wallet not connected');
      }

      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
      });

      await connection.confirmTransaction(sig, 'confirmed');
      return sig;
    },
    [connection, publicKey, signTransaction]
  );

  // Create campaign
  const handleCreateCampaign = useCallback(
    async (
      campaignId: string,
      title: string,
      description: string,
      goalSol: number,
      deadlineTimestamp: number
    ) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const ix = createCampaignInstruction(
        publicKey,
        campaignId,
        title,
        description,
        goalSol * LAMPORTS_PER_SOL,
        deadlineTimestamp
      );

      const tx = new Transaction().add(ix);
      const sig = await sendTx(tx);

      const { campaignPda, vaultPda } = getCampaignPDAs(campaignId);
      return { tx: sig, campaignPda, vaultPda };
    },
    [publicKey, sendTx]
  );

  // Donate
  const handleDonate = useCallback(
    async (campaignId: string, amountSol: number) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const ix = donateInstruction(
        publicKey,
        campaignId,
        amountSol * LAMPORTS_PER_SOL
      );

      const tx = new Transaction().add(ix);
      return sendTx(tx);
    },
    [publicKey, sendTx]
  );

  // Withdraw
  const handleWithdraw = useCallback(
    async (campaignId: string, amountSol: number) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const ix = withdrawInstruction(
        publicKey,
        campaignId,
        amountSol * LAMPORTS_PER_SOL
      );

      const tx = new Transaction().add(ix);
      return sendTx(tx);
    },
    [publicKey, sendTx]
  );

  // Close
  const handleClose = useCallback(
    async (campaignId: string) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const ix = closeCampaignInstruction(publicKey, campaignId);
      const tx = new Transaction().add(ix);
      return sendTx(tx);
    },
    [publicKey, sendTx]
  );

  // Fetch campaign
  const handleFetchCampaign = useCallback(
    async (campaignId: string) => {
      return fetchCampaign(connection, campaignId);
    },
    [connection]
  );

  // Fetch vault balance
  const handleFetchVaultBalance = useCallback(
    async (campaignId: string) => {
      return fetchVaultBalance(connection, campaignId);
    },
    [connection]
  );

  // List all campaigns
  const handleListCampaigns = useCallback(async () => {
    return listCampaigns(connection);
  }, [connection]);

  return {
    isReady: !!publicKey && !!signTransaction,
    programId: PROGRAM_ID,
    getCampaignPDAs,
    createCampaign: handleCreateCampaign,
    donate: handleDonate,
    withdraw: handleWithdraw,
    closeCampaign: handleClose,
    fetchCampaign: handleFetchCampaign,
    fetchVaultBalance: handleFetchVaultBalance,
    listCampaigns: handleListCampaigns,
  };
}
