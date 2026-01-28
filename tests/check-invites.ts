import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Offuscate } from "../target/types/offuscate";

describe("check invites", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Offuscate as Program<Offuscate>;

  it("Lists all invites", async () => {
    const invites = await program.account.invite.all();
    console.log(`Found ${invites.length} invites:`);
    
    for (const { publicKey, account } of invites) {
      console.log({
        pda: publicKey.toBase58(),
        inviteCode: account.inviteCode,
        status: Object.keys(account.status)[0],
        batch: account.batch.toBase58(),
      });
    }
  });
});
