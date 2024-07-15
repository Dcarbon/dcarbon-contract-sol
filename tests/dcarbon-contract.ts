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
import { ASSOCIATED_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { createAccount, sleep } from './utils';
import * as dotenv from 'dotenv';
import { expect } from 'chai';
import BN from 'bn.js';

dotenv.config();

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID.toString());

type ConfigArgs = IdlTypes<DcarbonContract>['configArgs'];

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
      const adminAddress = Keypair.generate().publicKey;

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
      const another_master = Keypair.generate();

      await createAccount({
        provider: anchorProvider,
        newAccountKeypair: another_master,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      });

      const [masterPda] = PublicKey.findProgramAddressSync([Buffer.from('master')], program.programId);

      const sig = await program.methods
        .transferMasterRights(another_master.publicKey)
        .accounts({
          signer: upgradableAuthority.publicKey,
        })
        .rpc({
          maxRetries: 20,
          skipPreflight: true,
        });

      console.log('Transfer right: ', sig);

      await sleep(5000);

      const masterPdaData = await program.account.master.fetch(masterPda);
      expect(masterPdaData.masterKey.toString(), 'Expect must be the new master').to.eq(
        another_master.publicKey.toString(),
      );

      const transferRightBack = await program.methods
        .transferMasterRights(upgradableAuthority.publicKey)
        .accounts({
          signer: another_master.publicKey,
        })
        .signers([another_master])
        .instruction();

      const transferRightBackTxn = new Transaction().add(transferRightBack);
      transferRightBackTxn.feePayer = another_master.publicKey;
      transferRightBackTxn.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transferRightBackTxn.partialSign(another_master);

      const sig1 = await connection.sendTransaction(transferRightBackTxn, [another_master], { skipPreflight: true });
      console.log('Transfer right back: ', sig1);

      await sleep(5000);

      const masterPdaData2 = await program.account.master.fetch(masterPda);
      expect(masterPdaData2.masterKey.toString(), 'Expect must be the old master').to.eq(
        upgradableAuthority.publicKey.toString(),
      );
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
    it('Init config', async () => {
      const configArgs: ConfigArgs = {
        mintingFee: new BN(11),
        rate: new BN(1),
      };

      const [configContract] = PublicKey.findProgramAddressSync([Buffer.from('contract_config')], program.programId);

      const tx = await program.methods
        .initConfig(configArgs)
        .accounts({
          signer: anchorProvider.wallet.publicKey,
          mint: new PublicKey('f5p4t6kbLSH7zJnxg8fMcAh5aec5zgLBffkm5qP1koR'),
        })
        .remainingAccounts([
          {
            pubkey: configContract,
            isWritable: true,
            isSigner: false,
          },
        ])
        .rpc({
          skipPreflight: true,
        });

      console.log('Init contract config: ', tx);
    });
  });

  // xit("Register device", async () => {
  //     const [authority] = PublicKey.findProgramAddressSync([Buffer.from('authority')], program.programId)
  //     const creator: CreatorArgs = {
  //         address: publicKey(authority.toString()),
  //         verified: true,
  //         share: 100
  //     }
  //
  //     const createArgsVec: CreateArgsArgs = {
  //         __kind: "V1",
  //         name: 'DCarbon Project Test',
  //         symbol: "DCPT",
  //         uri: 'https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY',
  //         sellerFeeBasisPoints: percentAmount(5.5),
  //         decimals: some(0),
  //         creators: [creator],
  //         tokenStandard: TokenStandard.FungibleAsset
  //     }
  //
  //     const mint = Keypair.generate()
  //
  //     const device: Project = {
  //         id: generateRandomObjectId(),
  //         mint: mint.publicKey,
  //         config: {}
  //     }
  //
  //     const serialize = getCreateArgsSerializer()
  //     const data = serialize.serialize(createArgsVec)
  //
  //     const [metadata] = PublicKey.findProgramAddressSync(
  //         [
  //             Buffer.from('metadata'),
  //             TOKEN_METADATA_PROGRAM_ID.toBuffer(),
  //             mint.publicKey.toBuffer(),
  //         ],
  //         TOKEN_METADATA_PROGRAM_ID
  //     );
  //
  //     // Add your test here.
  //     const tx = await program.methods.registerProject(device, Buffer.from(data))
  //         .accounts({
  //             creator: anchorProvider.wallet.publicKey,
  //             mint: mint.publicKey,
  //             metadata: metadata,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
  //             tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //         })
  //         .signers([mint])
  //         .rpc({
  //             skipPreflight: true
  //         })
  //
  //     console.log('Register device: ', tx)
  // });

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

    // Add your test here.
    const tx = await program.methods
      .createMint(Buffer.from(data))
      .accounts({
        creator: anchorProvider.wallet.publicKey,
        mint: mint.publicKey,
        metadata: metadata,
        tokenProgram: TOKEN_PROGRAM_ID,
        sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([mint])
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

  // const registerProject = async (metadataObj?: any) => {
  //     const [authority] = PublicKey.findProgramAddressSync([Buffer.from('authority')], program.programId)
  //     const creator: CreatorArgs = {
  //         address: publicKey(authority.toString()),
  //         verified: true,
  //         share: 100
  //     }
  //
  //     const createArgsVec: CreateArgsArgs = {
  //         __kind: "V1",
  //         name: metadataObj ? metadataObj.name : 'Project 1',
  //         symbol: metadataObj ? metadataObj.symbol : "P1T",
  //         uri: metadataObj ? metadataObj.uri : 'https://dev-bucket.kyupad.xyz/public/metadata/spl-token/metadata_project_1.json',
  //         sellerFeeBasisPoints: percentAmount(5.5),
  //         decimals: some(0),
  //         creators: [creator],
  //         tokenStandard: TokenStandard.FungibleAsset,
  //         collection: null
  //     }
  //
  //     const mint = Keypair.generate()
  //
  //     const projectId = generateRandomObjectId()
  //
  //     const device: Project = {
  //         id: projectId,
  //         mint: mint.publicKey,
  //         config: {}
  //     }
  //
  //     const serialize = getCreateArgsSerializer()
  //     const data = serialize.serialize(createArgsVec)
  //
  //
  //     const [metadata] = PublicKey.findProgramAddressSync(
  //         [
  //             Buffer.from('metadata'),
  //             TOKEN_METADATA_PROGRAM_ID.toBuffer(),
  //             mint.publicKey.toBuffer(),
  //         ],
  //         TOKEN_METADATA_PROGRAM_ID
  //     );
  //
  //     // Add your test here.
  //     const tx = await program.methods.registerProject(device, Buffer.from(data))
  //         .accounts({
  //             creator: anchorProvider.wallet.publicKey,
  //             mint: mint.publicKey,
  //             metadata: metadata,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
  //             tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //         })
  //         .signers([mint])
  //         .rpc({
  //             skipPreflight: true
  //         })
  //
  //     console.log('Register device: ', tx)
  //
  //     return {
  //         device,
  //         mint,
  //         metadata,
  //     }
  // }
});
