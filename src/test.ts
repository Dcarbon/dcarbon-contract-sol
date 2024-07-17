import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { DcarbonContract } from '../target/types/dcarbon_contract';
import { Program } from '@coral-xyz/anchor';
import IDL from '../target/idl/dcarbon_contract.json';
import * as dotenv from 'dotenv';

dotenv.config();

const keypair = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));

console.log(keypair.secretKey);

const connection = new Connection(process.env.DEV_RPC_ENDPOINT, 'confirmed');

const prorgram = new Program<DcarbonContract>(IDL as DcarbonContract, {
  connection: connection,
});

const transferMasterRight = async () => {
  const transferMasterbackIns = await prorgram.methods
    .transferMasterRights(new PublicKey('Fxu7o9k8BKKAJyD94UfESH9sMrEFtoXtRRbQiiUFD1pv'))
    .accounts({
      signer: keypair.publicKey,
    })
    .instruction();

  const tx = new Transaction().add(transferMasterbackIns);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = keypair.publicKey;

  tx.partialSign(keypair);

  const sig = await connection.sendTransaction(tx, [keypair], { skipPreflight: true });

  console.log('Sig: ', sig);
};

transferMasterRight();
