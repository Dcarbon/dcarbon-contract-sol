import { ObjectId } from 'mongodb';
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import { AnchorProvider } from '@coral-xyz/anchor';

export const generateRandomObjectId = () => {
  const objectId = new ObjectId();
  return objectId.toHexString();
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const createAccount = async ({
  provider,
  newAccountKeypair,
  lamports,
}: {
  provider: AnchorProvider;
  newAccountKeypair: Keypair;
  lamports: number;
}) => {
  const dataLength = 0;

  const rentExemptionAmount = await provider.connection.getMinimumBalanceForRentExemption(dataLength);

  const createAccountIns = SystemProgram.createAccount({
    fromPubkey: provider.wallet.publicKey,
    newAccountPubkey: newAccountKeypair.publicKey,
    lamports: rentExemptionAmount,
    space: dataLength,
    programId: SystemProgram.programId,
  });

  const transferIns = SystemProgram.transfer({
    fromPubkey: provider.wallet.publicKey,
    toPubkey: newAccountKeypair.publicKey,
    lamports: lamports,
  });

  const tx = new Transaction().add(createAccountIns).add(transferIns);

  const sig = provider.sendAndConfirm(tx, [newAccountKeypair], {
    maxRetries: 20,
  });

  console.log(`Create account ${newAccountKeypair.publicKey} with ${lamports} lamports: ${sig}`);
};
