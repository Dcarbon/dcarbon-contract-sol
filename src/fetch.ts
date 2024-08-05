import { clusterApiUrl, Connection } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { DcarbonContract } from '../target/types/dcarbon_contract';
import idl from '../target/idl/dcarbon_contract.json';
import * as bs58 from 'bs58';

const fetchAllTokenFollowProject = async () => {
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  const program = new Program<DcarbonContract>(idl as DcarbonContract, {
    connection: connection,
  });

  const projectId = 0;

  const accounts = await connection.getProgramAccounts(program.programId, {
    dataSlice: { offset: 0, length: 0 },
    filters: [
      {
        // dataSize: 8 + 43,
        memcmp: {
          offset: 0,
          bytes: bs58.encode(
            idl.accounts.find((acc: { name: string; discriminator: number[] }) => acc.name === 'Claim')
              .discriminator as number[],
          ),
        },
      },
      {
        memcmp: {
          offset: 8 + 1 + 32 + 8,
          bytes: bs58.encode(numberToUint8Array(projectId)),
        },
      },
    ],
  });

  console.log(accounts.length);
  for (let i = 0; i < accounts.length; i++) {
    console.log(accounts[i].pubkey);
    const data = await program.account.claim.fetch(accounts[i].pubkey);
    console.log('Mint: ', data.mint);
    console.log('Amount: ', data.amount);
  }
};

function numberToUint8Array(num: number) {
  if (num < 0 || num > 65535) {
    throw new RangeError('Number must be between 0 and 65535.');
  }
  const highByte = (num >> 8) & 0xff; // Extract the high byte
  const lowByte = num & 0xff; // Extract the low byte
  return new Uint8Array([highByte, lowByte]);
}

fetchAllTokenFollowProject();
