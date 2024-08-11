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

  console.log(Buffer.from('device_status').toJSON().data);

  const [deviceStatus] = PublicKey.findProgramAddressSync(
    [Buffer.from('device_status'), u16ToBytes(393)],
    program.programId,
  );

  const [coef] = PublicKey.findProgramAddressSync(
    [Buffer.from('coefficient'), Buffer.from('FABBI_TEST_1')],
    program.programId,
  );
  const info = await connection.getAccountInfo(coef);
  console.log(Array.from(info.data));
  const coefData = await program.account.coefficient.fetch(coef);
  console.log(BigInt(coefData.value.toString()));
  const deviceStatusData = await program.account.deviceStatus.fetch(deviceStatus);
  console.log(deviceStatusData.nonce);
  console.log(bs58.decode('9q'));

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

export function u64toBytes(value: number): Uint8Array {
  const buffer = new ArrayBuffer(8); // u16 cần 2 bytes
  const view = new DataView(buffer);
  view.setUint16(0, value, true); // true để lưu theo Little Endian, false để lưu theo Big Endian
  return new Uint8Array(buffer);
}

fetchAllTokenFollowProject();
