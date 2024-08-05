import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { DcarbonContract } from '../target/types/dcarbon_contract';
import { Program } from '@coral-xyz/anchor';
import IDL from '../target/idl/dcarbon_contract.json';
import * as dotenv from 'dotenv';
import {
  createApproveCheckedInstruction,
  createInitializeMint2Instruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from '@solana/spl-token';
import { TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';

dotenv.config();

const keypair = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));

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

// transferMasterRight();

const disableMint = async () => {
  const mint = Keypair.generate();

  const createMintIns = createInitializeMint2Instruction(mint.publicKey, 9, keypair.publicKey, keypair.publicKey);

  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const tx = new Transaction()
    .add(
      SystemProgram.createAccount({
        fromPubkey: keypair.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
    )

    .add(createMintIns)
    .add(createSetAuthorityInstruction(mint.publicKey, keypair.publicKey, 0, null, [], TOKEN_PROGRAM_ID));

  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = keypair.publicKey;

  const sig = await connection.sendTransaction(tx, [keypair, mint], { skipPreflight: true });

  console.log('Sig: ', sig);
};

disableMint();
transferMasterRight();

const delegateToken = async () => {
  const mint = new PublicKey('49912SPjYgzU2UmLBcN1rmq8BHe8YgyYssPoxSPEYAaE');

  const randomGuy = Keypair.generate();
  const signer = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));

  const tokenAccountPubkey = getAssociatedTokenAddressSync(mint, signer.publicKey);

  const tx = new Transaction().add(
    createApproveCheckedInstruction(
      tokenAccountPubkey, // token account
      mint, // mint
      randomGuy.publicKey, // delegate
      signer.publicKey, // owner of token account
      1, // amount, if your deciamls is 8, 10^8 for 1 token
      0, // decimals
    ),
  );

  const connection = new Connection(process.env.DEV_RPC_ENDPOINT);

  const sig = await connection.sendTransaction(tx, [signer], {
    skipPreflight: true,
  });

  console.log('Sig: ', sig);
};
delegateToken();
