import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, IdlTypes, Program } from '@coral-xyz/anchor';
import { DcarbonContract } from '../target/types/dcarbon_contract';
import {
  CreateArgsArgs,
  getCreateArgsSerializer,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { percentAmount, some } from '@metaplex-foundation/umi';
import {
  AddressLookupTableProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
} from '@solana/web3.js';
import { ASSOCIATED_PROGRAM_ID, associatedAddress, TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { createAccount, getRandomU16, sleep, u16ToBytes, u32ToBytes } from './utils';
import * as dotenv from 'dotenv';
import { expect } from 'chai';
import BN from 'bn.js';
import { prepareParams } from '../src/verify';
import { ethers } from 'ethers';
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  transferChecked,
} from '@solana/spl-token';
import * as bs58 from 'bs58';

dotenv.config();

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID.toString());

type ConfigArgs = IdlTypes<DcarbonContract>['configArgs'];
type RegisterDeviceArgs = IdlTypes<DcarbonContract>['registerDeviceArgs'];
type CreateFtArgs = IdlTypes<DcarbonContract>['createFtArgs'];
type MintSftArgs = IdlTypes<DcarbonContract>['mintSftArgs'];
type VerifyMessageArgs = IdlTypes<DcarbonContract>['verifyMessageArgs'];
type ListingArgs = IdlTypes<DcarbonContract>['listingArgs'];

describe('dcarbon-contract', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.DcarbonContract as Program<DcarbonContract>;
  const anchorProvider = program.provider as AnchorProvider;
  const connection = anchorProvider.connection;
  const upgradableAuthority = anchorProvider.wallet;

  describe('🔑🔑🔑 Permission', async () => {
    xit('Init master', async () => {
      const [masterPda] = PublicKey.findProgramAddressSync([Buffer.from('master')], program.programId);

      const BPF_LOADER_PROGRAM = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

      const [programData] = PublicKey.findProgramAddressSync([program.programId.toBuffer()], BPF_LOADER_PROGRAM);

      const createAdminIns = await program.methods
        .initMaster(upgradableAuthority.publicKey)
        .accounts({
          signer: upgradableAuthority.publicKey,
          programData: programData,
        })
        .remainingAccounts([
          {
            pubkey: masterPda,
            isSigner: false,
            isWritable: true,
          },
        ])
        .instruction();

      const tx = new Transaction().add(createAdminIns);

      const sig = await anchorProvider.sendAndConfirm(tx, [], {
        maxRetries: 20,
        skipPreflight: true,
      });

      console.log('Init master: ', sig);

      await sleep(2000);

      const masterData = await program.account.master.fetch(masterPda);

      expect(
        masterData.masterKey.toString() === upgradableAuthority.publicKey.toString(),
        'Expect master PDA have the key of master',
      ).to.be.true;
    });

    xit('Add admin', async () => {
      // const adminAddress = Keypair.generate().publicKey;
      const adminAddress = upgradableAuthority.publicKey;

      const [adminPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('admin'), adminAddress.toBuffer()],
        program.programId,
      );

      const addAdminIns = await program.methods
        .addAdmin(adminAddress)
        .accounts({
          signer: upgradableAuthority.publicKey,
        })
        .remainingAccounts([
          {
            pubkey: adminPda,
            isWritable: true,
            isSigner: false,
          },
        ])
        .instruction();

      const tx = new Transaction().add(addAdminIns);

      const sig = await anchorProvider.sendAndConfirm(tx, [], {
        maxRetries: 20,
        skipPreflight: true,
      });

      await sleep(2000);

      const adminPdaData = await program.account.admin.fetch(adminPda);

      console.log('Add admin: ', sig);

      expect(adminPdaData.adminKey.toString() === adminAddress.toString(), 'This account must to be initialize').to.be
        .true;
    });

    xit('Init another master but not deployer', async () => {
      const fakeDeployer = Keypair.generate();

      // create fakeMaster
      await createAccount({
        provider: anchorProvider,
        newAccountKeypair: fakeDeployer,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      });

      const BPF_LOADER_PROGRAM = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

      const [programData] = PublicKey.findProgramAddressSync([program.programId.toBuffer()], BPF_LOADER_PROGRAM);

      const createAdminIns = await program.methods
        .initMaster(fakeDeployer.publicKey)
        .accounts({
          signer: fakeDeployer.publicKey,
          programData: programData,
        })
        .instruction();

      const tx = new Transaction().add(createAdminIns);

      tx.feePayer = fakeDeployer.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      tx.partialSign(fakeDeployer);

      let expected_error = false;
      try {
        await connection.sendTransaction(tx, [fakeDeployer]);
      } catch (error) {
        expected_error = true;
      }

      expect(expected_error, 'Expect invest transaction must be failed').to.be.true;
    });

    xit('Add admin but not master', async () => {
      const fakeMaster = Keypair.generate();

      // create fakeMaster
      await createAccount({
        provider: anchorProvider,
        newAccountKeypair: fakeMaster,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      });

      const [adminPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('admin'), fakeMaster.publicKey.toBuffer()],
        program.programId,
      );

      const addAdminIns = await program.methods
        .addAdmin(fakeMaster.publicKey)
        .accounts({
          signer: fakeMaster.publicKey,
        })
        .remainingAccounts([
          {
            pubkey: adminPda,
            isWritable: true,
            isSigner: false,
          },
        ])
        .instruction();

      const tx = new Transaction().add(addAdminIns);

      tx.feePayer = fakeMaster.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      tx.partialSign(fakeMaster);

      let expected_error = false;
      try {
        await connection.sendTransaction(tx, [fakeMaster]);
      } catch (error) {
        expected_error = true;
      }

      expect(expected_error, 'Expect invest transaction must be failed').to.be.true;
    });

    xit('Transfer master right', async () => {
      // const another_master = Keypair.generate();
      //
      // await createAccount({
      //   provider: anchorProvider,
      //   newAccountKeypair: another_master,
      //   lamports: 0.01 * LAMPORTS_PER_SOL,
      // });

      // const [masterPda] = PublicKey.findProgramAddressSync([Buffer.from('master')], program.programId);

      const sig = await program.methods
        .transferMasterRights(new PublicKey('33MkUmaAce3g6LfQZdYV9gKB4ypYDAWrScYfVDkNiCum'))
        .accounts({
          signer: upgradableAuthority.publicKey,
        })
        .rpc({
          maxRetries: 20,
          skipPreflight: true,
        });

      console.log('Transfer right: ', sig);

      // await sleep(5000);
      //
      // const masterPdaData = await program.account.master.fetch(masterPda);
      // expect(masterPdaData.masterKey.toString(), 'Expect must be the new master').to.eq(
      //   another_master.publicKey.toString(),
      // );
      //
      // const transferRightBack = await program.methods
      //   .transferMasterRights(upgradableAuthority.publicKey)
      //   .accounts({
      //     signer: another_master.publicKey,
      //   })
      //   .signers([another_master])
      //   .instruction();
      //
      // const transferRightBackTxn = new Transaction().add(transferRightBack);
      // transferRightBackTxn.feePayer = another_master.publicKey;
      // transferRightBackTxn.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      // transferRightBackTxn.partialSign(another_master);
      //
      // const sig1 = await connection.sendTransaction(transferRightBackTxn, [another_master], { skipPreflight: true });
      // console.log('Transfer right back: ', sig1);
      //
      // await sleep(5000);
      //
      // const masterPdaData2 = await program.account.master.fetch(masterPda);
      // expect(masterPdaData2.masterKey.toString(), 'Expect must be the old master').to.eq(
      //   upgradableAuthority.publicKey.toString(),
      // );
    });

    xit('Delete admin', async () => {
      const randomAdmin = Keypair.generate().publicKey;

      const [adminPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('admin'), randomAdmin.toBuffer()],
        program.programId,
      );

      const addAdminTxn = await program.methods
        .addAdmin(randomAdmin)
        .accounts({
          signer: upgradableAuthority.publicKey,
        })
        .remainingAccounts([
          {
            pubkey: adminPda,
            isWritable: true,
            isSigner: false,
          },
        ])
        .rpc({
          skipPreflight: true,
        });

      console.log('Add admin', addAdminTxn);

      await sleep(2000);

      const deleteAdminTxn = await program.methods
        .deleteAdmin(randomAdmin)
        .accounts({
          signer: upgradableAuthority.publicKey,
        })
        .rpc({
          skipPreflight: true,
        });

      console.log('Delete admin', deleteAdminTxn);
    });
  });

  describe('📕📕📕 Config', () => {
    xit('Init config', async () => {
      const configArgs: ConfigArgs = {
        mintingFee: 0.1,
        rate: 0.1,
        governanceAmount: 100_000,
      };

      const tx = await program.methods
        .initConfig(configArgs)
        .accounts({
          signer: anchorProvider.wallet.publicKey,
          mint: new PublicKey('f5p4t6kbLSH7zJnxg8fMcAh5aec5zgLBffkm5qP1koR'),
        })
        .rpc({
          skipPreflight: true,
        });

      console.log('Init contract config: ', tx);
    });

    xit('Set coefficient', async () => {
      const key = 'abc';
      const value = new BN(1);

      const tx = await program.methods.setCoefficient(key, value).accounts({}).rpc({
        skipPreflight: true,
      });

      console.log('Set coefficient: ', tx);
    });

    xit('Set minting fee', async () => {
      const mintingFee = 0.1;

      const tx = await program.methods
        .setMintingFee(mintingFee)
        .accounts({
          signer: upgradableAuthority.publicKey,
        })
        .rpc({
          skipPreflight: true,
        });

      console.log('Set minting fee: ', tx);
    });
  });

  describe('Device', () => {
    xit('Register device', async () => {
      const projectId = getRandomU16();
      const deviceId = getRandomU16();

      const registerDeviceArgs: RegisterDeviceArgs = {
        projectId,
        deviceId,
        deviceType: 1000,
        owner: Keypair.generate().publicKey,
        minter: Keypair.generate().publicKey,
      };

      const tx = await program.methods
        .registerDevice(registerDeviceArgs)
        .accounts({
          signer: upgradableAuthority.publicKey,
        })
        .rpc({
          skipPreflight: true,
        });

      console.log('Register device: ', tx);
    });

    xit('Set active', async () => {
      const projectId = getRandomU16();
      const deviceId = getRandomU16();

      const registerDeviceArgs: RegisterDeviceArgs = {
        projectId,
        deviceId,
        deviceType: 1000,
        owner: Keypair.generate().publicKey,
        minter: Keypair.generate().publicKey,
      };

      const tx = await program.methods
        .registerDevice(registerDeviceArgs)
        .accounts({
          signer: upgradableAuthority.publicKey,
        })
        .rpc({
          skipPreflight: true,
        });

      console.log('Register device: ', tx);

      const tx2 = await program.methods
        .setActive(projectId, deviceId)
        .accounts({
          signer: upgradableAuthority.publicKey,
        })
        .rpc({
          skipPreflight: true,
        });

      console.log('Set active', tx2);
    });

    xit('Mint sft', async () => {
      const { projectId, deviceId, owner } = await setupDevice();
      console.log('ProjectId: ', projectId);
      const mint = Keypair.generate();

      console.log('Mint: ', mint.publicKey.toString());

      const [metadata] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID,
      );

      const createArgsVec: CreateArgsArgs = {
        __kind: 'V1',
        name: 'DCarbon Token',
        symbol: 'DCPT',
        uri: 'https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY',
        sellerFeeBasisPoints: percentAmount(5.5),
        decimals: some(1),
        creators: null,
        tokenStandard: TokenStandard.FungibleAsset,
      };

      const serialize1 = getCreateArgsSerializer();
      const data1 = serialize1.serialize(createArgsVec);

      const ownerAta = associatedAddress({
        mint: mint.publicKey,
        owner: owner,
      });

      const mintSftArgs: MintSftArgs = {
        projectId: projectId,
        deviceId: deviceId,
        createMintDataVec: Buffer.from(data1),
        totalAmount: 2000,
        nonce: 1,
      };

      const { ethAddress, message, signature, recoveryId } = prepareParams();
      const eth_address = '4d0155c687739bce9440ffb8aba911b00b21ea56';
      const test = ethers.utils.arrayify('0x' + eth_address);
      const verifyMessageArgs: VerifyMessageArgs = {
        msg: message,
        recoveryId: recoveryId,
        sig: Array.from(signature),
        ethAddress: Array.from(test),
      };

      const [device] = PublicKey.findProgramAddressSync(
        [Buffer.from('device'), Buffer.from(u16ToBytes(projectId)), Buffer.from(u16ToBytes(deviceId))],
        program.programId,
      );

      const ins0 = anchor.web3.Secp256k1Program.createInstructionWithEthAddress({
        ethAddress: ethAddress,
        message: message,
        signature: signature,
        recoveryId: recoveryId,
      });

      const ins1 = await program.methods
        .mintSft(mintSftArgs, verifyMessageArgs)
        .accounts({
          signer: anchorProvider.wallet.publicKey,
          deviceOwner: owner,
          ownerAta: ownerAta,
          mint: mint.publicKey,
          metadata: metadata,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          ataProgram: ASSOCIATED_PROGRAM_ID,
        })
        .remainingAccounts([
          {
            pubkey: device,
            isSigner: false,
            isWritable: false,
          },
        ])
        .signers([mint])
        .instruction();

      const tx = new Transaction().add(ins0).add(ins1);

      const sig = await anchorProvider.sendAndConfirm(tx, [mint], { skipPreflight: true });

      console.log('Mint SFT: ', sig);
    });
  });

  describe('Marketplace', () => {
    const USDC = new PublicKey('6QLnQwoEzXNgrafQr3YNJtEsr4JuaY3ifNM4Lrs55hcc');

    it('Listing token with SOL', async () => {
      // get this mint from mins-sft
      const mint = new PublicKey('2Yk7gycCaLtViSPAPcAEUxQF82pCKqCWZEfLKSkfbvEH');
      const projectId = 56357;
      const sourceAta = getAssociatedTokenAddressSync(mint, upgradableAuthority.publicKey);

      const [marketplaceCounter] = PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace'), Buffer.from('counter')],
        program.programId,
      );

      const marketplaceCounterData = await program.account.marketplaceCounter.fetch(marketplaceCounter);

      const [tokenListingInfo] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('marketplace'),
          mint.toBuffer(),
          upgradableAuthority.publicKey.toBuffer(),
          u32ToBytes(marketplaceCounterData.nonce),
        ],
        program.programId,
      );

      const [tokenListingStatus] = PublicKey.findProgramAddressSync(
        [tokenListingInfo.toBuffer(), Buffer.from('token_listing_status')],
        program.programId,
      );

      const listingArgs: ListingArgs = {
        amount: 10,
        price: 0.1,
        projectId: projectId,
        currency: null,
      };

      const tx = await program.methods
        .listing(listingArgs)
        .accounts({
          signer: upgradableAuthority.publicKey,
          mint: mint,
          sourceAta: sourceAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          {
            pubkey: tokenListingInfo,
            isWritable: true,
            isSigner: false,
          },
          {
            pubkey: tokenListingStatus,
            isWritable: true,
            isSigner: false,
          },
        ])
        .rpc({
          skipPreflight: true,
        });

      console.log('Tx: ', tx);
    });

    xit('Listing token with token', async () => {
      // get this mint from mins-sft
      const mint = new PublicKey('6CpXvu18MecVmtVJi3RWwQ9x5F9dh8UEPemvTsdsZpxC');
      const projectId = 8030;
      const sourceAta = getAssociatedTokenAddressSync(mint, upgradableAuthority.publicKey);

      const [marketplaceCounter] = PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace'), Buffer.from('counter')],
        program.programId,
      );

      const marketplaceCounterData = await program.account.marketplaceCounter.fetch(marketplaceCounter);

      console.log(marketplaceCounterData.nonce);
      const listingArgs: ListingArgs = {
        amount: 10,
        price: 0.1,
        projectId: projectId,
        currency: USDC,
      };

      const tx = await program.methods
        .listing(listingArgs)
        .accounts({
          signer: upgradableAuthority.publicKey,
          mint: mint,
          sourceAta: sourceAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({
          skipPreflight: true,
        });

      console.log('Tx: ', tx);
    });

    xit('Buying token with SOL', async () => {
      const buyer = Keypair.generate();
      const mint = new PublicKey('8vJNo9AXBDczE5xMSEXvrQVNAWyBt6NdK7DtJ2n6LgTT');
      const token_owner = upgradableAuthority.publicKey;

      await createAccount({
        provider: anchorProvider,
        newAccountKeypair: buyer,
        lamports: LAMPORTS_PER_SOL / 10,
      });

      const tokenListingInfo = new PublicKey('4Kd2xEr6VR6fxMAUfA6VpkWjtTBCxgGyXFourUwHvmwi');

      const sourceAta = getAssociatedTokenAddressSync(mint, token_owner);
      const toAta = getAssociatedTokenAddressSync(mint, buyer.publicKey);

      const createAtaIns = createAssociatedTokenAccountInstruction(buyer.publicKey, toAta, buyer.publicKey, mint);

      const buyIns = await program.methods
        .buy(3)
        .accounts({
          signer: buyer.publicKey,
          mint: mint,
          sourceAta: sourceAta,
          toAta: toAta,
          tokenListingInfo: tokenListingInfo,
          tokenOwner: token_owner,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      const tx = new Transaction().add(createAtaIns).add(buyIns);
      tx.feePayer = buyer.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      tx.partialSign(buyer);

      const sig = await connection.sendTransaction(tx, [buyer], {
        skipPreflight: true,
      });

      console.log('Sig: ', sig);
    });

    xit('Buying token with token', async () => {
      const buyer = Keypair.generate();
      const mint = new PublicKey('6CpXvu18MecVmtVJi3RWwQ9x5F9dh8UEPemvTsdsZpxC');
      const token_owner = upgradableAuthority.publicKey;

      await createAccount({
        provider: anchorProvider,
        newAccountKeypair: buyer,
        lamports: LAMPORTS_PER_SOL / 10,
      });
      // const sourceAtaToken = getAssociatedTokenAddressSync(USDC, buyer.publicKey);
      const destinationAtaToken = getAssociatedTokenAddressSync(USDC, token_owner);

      const payer = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
      console.log('Payer: ', payer.publicKey);

      const sourceAtaToken = (await getOrCreateAssociatedTokenAccount(connection, payer, USDC, buyer.publicKey))
        .address;

      const sigTransfer = await transferChecked(
        connection,
        payer,
        destinationAtaToken,
        USDC,
        sourceAtaToken,
        upgradableAuthority.publicKey,
        10 * 10 ** 9,
        9,
        [],
        { skipPreflight: true },
      );

      console.log('Transfer USDC: ', sigTransfer);

      const tokenListingInfo = new PublicKey('BRZF19M2JPy8CPrcP9zEbXkqD5jq32ymHFeJQeJuxXrZ');

      const sourceAta = getAssociatedTokenAddressSync(mint, token_owner);
      const toAta = getAssociatedTokenAddressSync(mint, buyer.publicKey);

      const createAtaIns = createAssociatedTokenAccountInstruction(buyer.publicKey, toAta, buyer.publicKey, mint);

      const buyIns = await program.methods
        .buy(3)
        .accounts({
          signer: buyer.publicKey,
          mint: mint,
          sourceAta: sourceAta,
          toAta: toAta,
          tokenListingInfo: tokenListingInfo,
          tokenOwner: token_owner,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          {
            pubkey: TOKEN_PROGRAM_ID,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: USDC,
            isWritable: false,
            isSigner: false,
          },
          {
            pubkey: sourceAtaToken,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: destinationAtaToken,
            isSigner: false,
            isWritable: true,
          },
        ])
        .instruction();

      const tx = new Transaction().add(createAtaIns).add(buyIns);
      tx.feePayer = buyer.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      tx.partialSign(buyer);

      const sig = await connection.sendTransaction(tx, [buyer], {
        skipPreflight: true,
      });

      console.log('Sig: ', sig);
    });

    xit('Cancel listing', async () => {
      const mint = new PublicKey('2Yk7gycCaLtViSPAPcAEUxQF82pCKqCWZEfLKSkfbvEH');
      const signer = upgradableAuthority.publicKey;
      const nonce = 4;

      const tx = await program.methods
        .cancelListing(nonce)
        .accounts({
          signer,
          mint,
        })
        .rpc({
          skipPreflight: true,
        });

      console.log('Txn: ', tx);
    });
  });

  xit('Create mint', async () => {
    const createArgsVec: CreateArgsArgs = {
      __kind: 'V1',
      name: 'DCarbon Token',
      symbol: 'DCPT',
      uri: 'https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY',
      sellerFeeBasisPoints: percentAmount(5.5),
      decimals: some(9),
      creators: null,
      tokenStandard: TokenStandard.Fungible,
    };

    const mint = Keypair.generate();

    const serialize = getCreateArgsSerializer();
    const data = serialize.serialize(createArgsVec);

    const [metadata] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID,
    );

    const createFtArgs: CreateFtArgs = {
      totalSupply: new BN(100 * 10 ** 9),
      disableMint: true,
      disableFreeze: true,
      dataVec: Buffer.from(data),
    };

    const [authority] = PublicKey.findProgramAddressSync([Buffer.from('authority')], program.programId);

    const toAta = associatedAddress({
      mint: mint.publicKey,
      owner: authority,
    });

    // Add your test here.
    const tx = await program.methods
      .createFt(createFtArgs)
      .accounts({
        signer: anchorProvider.wallet.publicKey,
        mint: mint.publicKey,
        metadata: metadata,
        tokenProgram: TOKEN_PROGRAM_ID,
        sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([mint])
      .remainingAccounts([
        {
          pubkey: toAta,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: ASSOCIATED_PROGRAM_ID,
          isWritable: false,
          isSigner: false,
        },
      ])
      .rpc({
        skipPreflight: true,
      });

    console.log('Create mint: ', tx);
  });

  // xit('Mint SFT', async () => {
  //
  //     const {device, mint, metadata} = await registerProject()
  //
  //     const mintArgs: MintArgsArgs = {
  //         __kind: "V1",
  //         amount: 5,
  //         authorizationData: null
  //     }
  //
  //     const receiver = Keypair.generate()
  //     console.log('Public Key: ', receiver.publicKey)
  //     await createAccount({
  //         provider: anchorProvider,
  //         newAccountKeypair: receiver,
  //         lamports: 0.1 * LAMPORTS_PER_SOL
  //     })
  //
  //     const toAta = associatedAddress({
  //         mint: mint.publicKey,
  //         owner: receiver.publicKey
  //     })
  //
  //     const serialize = getMintArgsSerializer()
  //     const data = serialize.serialize(mintArgs)
  //
  //     const tx = await program.methods.mintSft(device.id, Buffer.from(data))
  //         .accounts({
  //             signer: anchorProvider.wallet.publicKey,
  //             receiver: receiver.publicKey,
  //             toAta,
  //             mint: mint.publicKey,
  //             metadata: metadata,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
  //             tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //             ataProgram: ASSOCIATED_PROGRAM_ID
  //         })
  //         .rpc({
  //             skipPreflight: true
  //         })
  //
  //     console.log('Mint SFT: ', tx)
  // })
  //
  // xit('Transform SFT to FT', async () => {
  //     const fungibleToken = new PublicKey('f5p4t6kbLSH7zJnxg8fMcAh5aec5zgLBffkm5qP1koR')
  //
  //     const {device, mint, metadata} = await registerProject()
  //
  //     const mintArgs: MintArgsArgs = {
  //         __kind: "V1",
  //         amount: 1,
  //         authorizationData: null
  //     }
  //
  //     const receiver = Keypair.generate()
  //
  //     await createAccount({
  //         provider: anchorProvider,
  //         newAccountKeypair: receiver,
  //         lamports: 0.1 * LAMPORTS_PER_SOL
  //     })
  //
  //     const toAta = associatedAddress({
  //         mint: mint.publicKey,
  //         owner: receiver.publicKey
  //     })
  //
  //     const serialize = getMintArgsSerializer()
  //     const data = serialize.serialize(mintArgs)
  //
  //     const tx = await program.methods.mintSft(device.id, Buffer.from(data))
  //         .accounts({
  //             signer: anchorProvider.wallet.publicKey,
  //             receiver: receiver.publicKey,
  //             toAta,
  //             mint: mint.publicKey,
  //             metadata: metadata,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
  //             tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //             ataProgram: ASSOCIATED_PROGRAM_ID
  //         })
  //         .rpc({
  //             skipPreflight: true
  //         })
  //
  //     console.log('Mint SFT: ', tx)
  //
  //     const burnArgs: BurnArgsArgs = {
  //         __kind: 'V1',
  //         amount: 1
  //     }
  //
  //     const toAta2 = associatedAddress({
  //         mint: fungibleToken,
  //         owner: receiver.publicKey
  //     })
  //
  //     const [metadataFt] = PublicKey.findProgramAddressSync(
  //         [
  //             Buffer.from('metadata'),
  //             TOKEN_METADATA_PROGRAM_ID.toBuffer(),
  //             fungibleToken.toBuffer(),
  //         ],
  //         TOKEN_METADATA_PROGRAM_ID
  //     );
  //
  //     const mintArgs2: MintArgsArgs = {
  //         __kind: "V1",
  //         amount: 10 ** 9,
  //         authorizationData: null
  //     }
  //
  //     const transformIns = await program.methods
  //         .transform(Buffer.from(getBurnArgsSerializer().serialize(burnArgs)), Buffer.from(serialize.serialize(mintArgs2)))
  //         .accounts({
  //             signer: anchorProvider.wallet.publicKey,
  //             receiver: receiver.publicKey,
  //             burnAta: toAta,
  //             toAta: toAta2,
  //             mintSft: mint.publicKey,
  //             mintFt: fungibleToken,
  //             metadataSft: metadata,
  //             metadataFt: metadataFt,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
  //             tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //             ataProgram: ASSOCIATED_PROGRAM_ID
  //         })
  //         .signers([receiver])
  //         .instruction()
  //
  //     const transactionV0 = new Transaction().add(transformIns)
  //
  //     const sig = await anchorProvider.sendAndConfirm(transactionV0, [receiver], {
  //         skipPreflight: true,
  //     });
  //
  //     console.log('Transform SFT to FT: ', sig)
  // })
  //
  // xit('Demo Register and Mint SFT', async () => {
  //
  //     const metadataPrj1 = {
  //         name: 'Project 1',
  //         symbol: 'PT1',
  //         uri: "https://dev-bucket.kyupad.xyz/public/metadata/spl-token/metadata_project_1.json"
  //     }
  //
  //     const metadataPrj2 = {
  //         name: 'Project 2',
  //         symbol: 'PT2',
  //         uri: "https://dev-bucket.kyupad.xyz/public/metadata/spl-token/metadata_project_2.json"
  //     }
  //
  //     const {device, mint, metadata} = await registerProject(metadataPrj1)
  //     const {device: project2, mint: mint2, metadata: metadata2} = await registerProject(metadataPrj2)
  //
  //     const mintArgs: MintArgsArgs = {
  //         __kind: "V1",
  //         amount: 5,
  //         authorizationData: null
  //     }
  //
  //     const receiver = Keypair.fromSecretKey(bs58.decode(process.env.PROJECT_1_PRIVATE_KEY))
  //
  //     const toAta = associatedAddress({
  //         mint: mint.publicKey,
  //         owner: receiver.publicKey
  //     })
  //
  //     const serialize = getMintArgsSerializer()
  //     const data = serialize.serialize(mintArgs)
  //
  //     const tx = await program.methods.mintSft(device.id, Buffer.from(data))
  //         .accounts({
  //             signer: anchorProvider.wallet.publicKey,
  //             receiver: receiver.publicKey,
  //             toAta,
  //             mint: mint.publicKey,
  //             metadata: metadata,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
  //             tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //             ataProgram: ASSOCIATED_PROGRAM_ID
  //         })
  //         .rpc({
  //             skipPreflight: true
  //         })
  //
  //     console.log('Mint SFT Project 1: ', tx)
  //
  //     const toAta2 = associatedAddress({
  //         mint: mint2.publicKey,
  //         owner: receiver.publicKey
  //     })
  //
  //     const tx2 = await program.methods.mintSft(project2.id, Buffer.from(data))
  //         .accounts({
  //             signer: anchorProvider.wallet.publicKey,
  //             receiver: receiver.publicKey,
  //             toAta: toAta2,
  //             mint: mint2.publicKey,
  //             metadata: metadata2,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
  //             tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //             ataProgram: ASSOCIATED_PROGRAM_ID
  //         })
  //         .rpc({
  //             skipPreflight: true
  //         })
  //
  //     console.log('Mint SFT Project 2: ', tx2)
  // })
  //
  // xit('Demo burn', async () => {
  //     const fungibleToken = new PublicKey('f5p4t6kbLSH7zJnxg8fMcAh5aec5zgLBffkm5qP1koR')
  //     const receiver = Keypair.fromSecretKey(bs58.decode(process.env.PROJECT_1_PRIVATE_KEY))
  //     const mint = new PublicKey("CCH2vkWhaqrmu59UrTyNSRwpYH8Y6msYN73mZ4FTovDv")
  //     const mint2 = new PublicKey("89XTmi1C6ekJq2McK8UekGQcEhkaFCRw7uFt8PnSAXD3")
  //
  //     const [metadata] = PublicKey.findProgramAddressSync(
  //         [
  //             Buffer.from('metadata'),
  //             TOKEN_METADATA_PROGRAM_ID.toBuffer(),
  //             mint.toBuffer(),
  //         ],
  //         TOKEN_METADATA_PROGRAM_ID
  //     );
  //
  //     const [metadata2] = PublicKey.findProgramAddressSync(
  //         [
  //             Buffer.from('metadata'),
  //             TOKEN_METADATA_PROGRAM_ID.toBuffer(),
  //             mint2.toBuffer(),
  //         ],
  //         TOKEN_METADATA_PROGRAM_ID
  //     );
  //
  //     const burnAta = associatedAddress({
  //         mint: mint,
  //         owner: receiver.publicKey
  //     })
  //
  //     const burnAta2 = associatedAddress({
  //         mint: mint2,
  //         owner: receiver.publicKey
  //     })
  //
  //
  //     const burnArgs: BurnArgsArgs = {
  //         __kind: 'V1',
  //         amount: 2
  //     }
  //
  //     const toAta = associatedAddress({
  //         mint: fungibleToken,
  //         owner: receiver.publicKey
  //     })
  //
  //     const [metadataFt] = PublicKey.findProgramAddressSync(
  //         [
  //             Buffer.from('metadata'),
  //             TOKEN_METADATA_PROGRAM_ID.toBuffer(),
  //             fungibleToken.toBuffer(),
  //         ],
  //         TOKEN_METADATA_PROGRAM_ID
  //     );
  //
  //     const mintArgs: MintArgsArgs = {
  //         __kind: "V1",
  //         amount: 2 * 10 ** 9,
  //         authorizationData: null
  //     }
  //
  //     const serialize = getMintArgsSerializer()
  //
  //     const transformIns = await program.methods
  //         .transform(Buffer.from(getBurnArgsSerializer().serialize(burnArgs)), Buffer.from(serialize.serialize(mintArgs)))
  //         .accounts({
  //             signer: anchorProvider.wallet.publicKey,
  //             receiver: receiver.publicKey,
  //             burnAta: burnAta,
  //             toAta: toAta,
  //             mintSft: mint,
  //             mintFt: fungibleToken,
  //             metadataSft: metadata,
  //             metadataFt: metadataFt,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
  //             tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //             ataProgram: ASSOCIATED_PROGRAM_ID
  //         })
  //         .signers([receiver])
  //         .instruction()
  //
  //     const transformIns2 = await program.methods
  //         .transform(Buffer.from(getBurnArgsSerializer().serialize(burnArgs)), Buffer.from(serialize.serialize(mintArgs)))
  //         .accounts({
  //             signer: anchorProvider.wallet.publicKey,
  //             receiver: receiver.publicKey,
  //             burnAta: burnAta2,
  //             toAta: toAta,
  //             mintSft: mint2,
  //             mintFt: fungibleToken,
  //             metadataSft: metadata2,
  //             metadataFt: metadataFt,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
  //             tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //             ataProgram: ASSOCIATED_PROGRAM_ID
  //         })
  //         .signers([receiver])
  //         .instruction()
  //
  //     const transactionV0 = new Transaction().add(transformIns)
  //     // transactionV0.add(transformIns2)
  //
  //     const sig = await anchorProvider.sendAndConfirm(transactionV0, [receiver], {
  //         skipPreflight: true,
  //     });
  //
  //     console.log('Transform SFT to FT: ', sig)
  // })

  xit('Create lookup Table', async () => {
    // Init lookup table adđress
    const slot = await anchorProvider.connection.getSlot();

    // Add 2 instruction to create lookupTableAddress and saved lookupTableAddress
    const [createLookupTableIns, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
      authority: anchorProvider.wallet.publicKey,
      payer: anchorProvider.wallet.publicKey,
      recentSlot: slot,
    });

    const extendInstruction = AddressLookupTableProgram.extendLookupTable({
      payer: anchorProvider.wallet.publicKey,
      authority: anchorProvider.wallet.publicKey,
      lookupTable: lookupTableAddress,
      addresses: [TOKEN_PROGRAM_ID, SYSVAR_INSTRUCTIONS_PUBKEY, TOKEN_METADATA_PROGRAM_ID, ASSOCIATED_PROGRAM_ID],
    });

    const createLookupTableTx = new Transaction().add(createLookupTableIns).add(extendInstruction);

    const createLookupTableSig = await anchorProvider.sendAndConfirm(createLookupTableTx, [], {
      skipPreflight: true,
    });

    console.log('Create lookup table sig: ', createLookupTableSig);
    console.log('Address lookup: ', lookupTableAddress);
  });

  const setupDevice = async () => {
    const projectId = getRandomU16();
    const deviceId = getRandomU16();

    const owner = upgradableAuthority.publicKey;

    // const owner = Keypair.generate().publicKey;
    //
    const registerDeviceArgs: RegisterDeviceArgs = {
      projectId,
      deviceId,
      deviceType: 1000,
      owner: owner,
      minter: upgradableAuthority.publicKey,
    };

    const tx = await program.methods
      .registerDevice(registerDeviceArgs)
      .accounts({
        signer: upgradableAuthority.publicKey,
      })
      .rpc({
        skipPreflight: true,
      });

    console.log('Register device: ', tx);

    const tx2 = await program.methods
      .setActive(projectId, deviceId)
      .accounts({
        signer: upgradableAuthority.publicKey,
      })
      .rpc({
        skipPreflight: true,
      });

    console.log('Set active', tx2);

    return {
      projectId,
      deviceId,
      owner,
    };
  };
});
