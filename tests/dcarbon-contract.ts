import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { DcarbonContract } from '../target/types/dcarbon_contract';

describe('dcarbon-contract', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.DcarbonContract as Program<DcarbonContract>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log('Your transaction signature', tx);
  });
});
