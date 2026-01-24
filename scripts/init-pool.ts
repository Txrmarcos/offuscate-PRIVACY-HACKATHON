import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq");

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = require("../target/idl/offuscate.json");
  const program = new anchor.Program(idl, provider) as any;

  console.log("Wallet:", provider.wallet.publicKey.toString());

  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("privacy_pool")],
    PROGRAM_ID
  );
  const [poolVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault")],
    PROGRAM_ID
  );

  console.log("Pool PDA:", poolPda.toString());
  console.log("Pool Vault:", poolVaultPda.toString());

  // Init Privacy Pool
  try {
    await program.account.privacyPool.fetch(poolPda);
    console.log("✅ Pool already initialized!");
  } catch (e) {
    console.log("🔄 Initializing Privacy Pool...");
    const tx = await program.methods
      .initPrivacyPool()
      .accounts({
        authority: provider.wallet.publicKey,
        pool: poolPda,
        poolVault: poolVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("✅ Pool initialized! Tx:", tx);
  }

  // Init Churn Vaults
  for (let i = 0; i < 3; i++) {
    const indexBuffer = Buffer.alloc(1);
    indexBuffer.writeUInt8(i);

    const [churnStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("churn_state"), indexBuffer],
      PROGRAM_ID
    );
    const [churnVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("churn_vault"), indexBuffer],
      PROGRAM_ID
    );

    try {
      await program.account.churnVaultState.fetch(churnStatePda);
      console.log(`✅ Churn Vault ${i} exists`);
    } catch (e) {
      console.log(`🔄 Init Churn Vault ${i}...`);
      try {
        const tx = await program.methods
          .initChurnVault(i)
          .accounts({
            authority: provider.wallet.publicKey,
            pool: poolPda,
            churnState: churnStatePda,
            churnVault: churnVaultPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        console.log(`✅ Churn ${i} done! Tx:`, tx);
      } catch (err: any) {
        console.log(`❌ Churn ${i} failed:`, err.message?.slice(0, 150));
      }
    }
  }

  console.log("\n🎉 Done!");
}

main().catch(console.error);
