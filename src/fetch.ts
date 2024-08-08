import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js';
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
          bytes: bs58.encode(u16ToBytes(projectId)),
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

const fetchAllTokenListingFromProject = async () => {
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  const program = new Program<DcarbonContract>(idl as DcarbonContract, {
    connection: connection,
  });

  const projectId = 148;

  const accounts = await connection.getProgramAccounts(program.programId, {
    dataSlice: { offset: 0, length: 0 },
    filters: [
      {
        // dataSize: 8 + 43,
        memcmp: {
          offset: 0,
          bytes: bs58.encode(
            idl.accounts.find((acc: { name: string; discriminator: number[] }) => acc.name === 'TokenListingInfo')
              .discriminator as number[],
          ),
        },
      },
      {
        memcmp: {
          offset: 8 + 32 + 32 + 8 + 8,
          bytes: bs58.encode(u16ToBytes(projectId)),
        },
      },
    ],
  });

  for (let i = 0; i < accounts.length; i++) {
    const tokenListingInfoData = await program.account.tokenListingInfo.fetch(accounts[i].pubkey);
    console.log('Info: ', tokenListingInfoData);
    const [tokenListingStatus] = PublicKey.findProgramAddressSync(
      [accounts[i].pubkey.toBuffer(), Buffer.from('token_listing_status')],
      program.programId,
    );

    const tokenListingStatusData = await program.account.tokenListingStatus.fetch(tokenListingStatus);
    console.log('Status: ', tokenListingStatusData);
  }
};
fetchAllTokenListingFromProject();

export function u16ToBytes(value: number): Uint8Array {
  const buffer = new ArrayBuffer(2); // u16 cần 2 bytes
  const view = new DataView(buffer);
  view.setUint16(0, value, true); // true để lưu theo Little Endian, false để lưu theo Big Endian
  return new Uint8Array(buffer);
}

fetchAllTokenFollowProject();
