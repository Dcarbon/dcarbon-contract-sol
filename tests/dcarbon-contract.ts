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
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { ASSOCIATED_PROGRAM_ID, associatedAddress, TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { createAccount, getRandomU16, sleep, u16ToBytes } from './utils';
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
  const payer = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));

  const vault = new PublicKey(process.env.VAULT);

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
        governanceAmount: 100,
        vault: vault,
      };

      const tx = await program.methods
        .initConfig(configArgs)
        .accounts({
          signer: anchorProvider.wallet.publicKey,
          mint: new PublicKey('f5p4t6kbLSH7zJnxg8fMcAh5aec5zgLBffkm5qP1koR'),
          governanceMint: new PublicKey('Dy68XsAW2ihPTWE4PDwc8U2CADBbctUbJ7DoDHyuCnx9'),
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
    const lookupTableAddress = new PublicKey('FK3zqpvK4oSn5mRxajtURvGBC94ZcADGeipUvhWVG4mu');
    xit('Register device', async () => {
      const projectId = getRandomU16();
      const deviceId = getRandomU16();

      await program.methods
        .setMintingLimit(1000, 50.1)
        .accounts({
          signer: upgradableAuthority.publicKey,
        })
        .rpc({
          skipPreflight: true,
        });

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

      const vaultAta = associatedAddress({
        mint: mint.publicKey,
        owner: vault,
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
          vaultAta: vaultAta,
          deviceOwner: owner,
          vault: vault,
          ownerAta: ownerAta,
          mint: mint.publicKey,
          metadata: metadata,
          sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
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

      const lookupTableAccount = (await connection.getAddressLookupTable(lookupTableAddress)).value;

      const messageV0 = new TransactionMessage({
        payerKey: upgradableAuthority.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [ins0, ins1],
      }).compileToV0Message([lookupTableAccount]);

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([payer, mint]);

      const sig = await connection.sendRawTransaction(transaction.serialize());

      console.log('Mint SFT: ', sig);
    });

    xit('Claim DCarbon (Governance token)', async () => {
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

      const TOKEN = new PublicKey('Dy68XsAW2ihPTWE4PDwc8U2CADBbctUbJ7DoDHyuCnx9');

      const tokenAtaReceiver = getAssociatedTokenAddressSync(TOKEN, owner);

      const [authority] = PublicKey.findProgramAddressSync([Buffer.from('authority')], program.programId);

      const tokenAtaSender = associatedAddress({
        mint: TOKEN,
        owner: authority,
      });

      const tokenAtaAccount = await connection.getAccountInfo(tokenAtaReceiver);

      const txClaim = new Transaction();
      txClaim.feePayer = owner;
      txClaim.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      if (!tokenAtaAccount || !tokenAtaAccount.lamports) {
        txClaim.add(createAssociatedTokenAccountInstruction(owner, tokenAtaReceiver, owner, TOKEN));
      }

      // claim governance token
      const claimTx = await program.methods
        .claimGovernanceToken()
        .accounts({
          signer: owner,
          tokenMint: TOKEN,
          tokenAtaReceiver: tokenAtaReceiver,
          tokenAtaSender: tokenAtaSender,
        })
        .instruction();

      txClaim.add(claimTx);

      const haha = await anchorProvider.sendAndConfirm(txClaim, [], {
        skipPreflight: true,
      });

      console.log('Sig: ', haha);
    });

    xit('Swap sft', async () => {
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

      const vaultAta = associatedAddress({
        mint: mint.publicKey,
        owner: vault,
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
          vaultAta: vaultAta,
          deviceOwner: owner,
          vault: vault,
          ownerAta: ownerAta,
          mint: mint.publicKey,
          metadata: metadata,
          sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
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

      const lookupTableAccount = (await connection.getAddressLookupTable(lookupTableAddress)).value;

      const messageV0 = new TransactionMessage({
        payerKey: upgradableAuthority.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [ins0, ins1],
      }).compileToV0Message([lookupTableAccount]);

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([payer, mint]);

      const sig = await connection.sendRawTransaction(transaction.serialize());
      console.log('Mint SFT: ', sig);

      const mintFt = new PublicKey('3ZqEW87VxgjKu6G4r9TmauYRV7pJ6xm5ayWRT3WMPz6Y');

      const [metadataFt] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintFt.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID,
      );

      const toAta = getAssociatedTokenAddressSync(mintFt, owner);
      const checkToAta = await connection.getAccountInfo(toAta);

      const txSwapIns = await program.methods
        .swapSft(2)
        .accounts({
          signer: upgradableAuthority.publicKey,
          burnAta: ownerAta,
          toAta,
          mintSft: mint.publicKey,
          mintFt: mintFt,
          metadataSft: metadata,
          metadataFt: metadataFt,
          sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .instruction();

      const tx = new Transaction();
      if (!checkToAta) {
        const createToAtaIns = createAssociatedTokenAccountInstruction(
          upgradableAuthority.publicKey,
          toAta,
          owner,
          mintFt,
        );
        tx.add(createToAtaIns);
      }
      tx.add(txSwapIns);
      tx.feePayer = upgradableAuthority.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig_1 = await anchorProvider.sendAndConfirm(tx, [], {
        skipPreflight: true,
      });

      // const messageV0_1 = new TransactionMessage({
      //   payerKey: upgradableAuthority.publicKey,
      //   recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      //   instructions: [createToAtaIns, txSwapIns],
      // }).compileToV0Message();

      // const transaction_1 = new VersionedTransaction(messageV0_1);
      // transaction.sign([payer]);

      // const sig_1 = await connection.sendRawTransaction(transaction_1.serialize());
      console.log('Tx swap: ', sig_1);
    });
  });

  describe('Marketplace', () => {
    const USDC = new PublicKey('6QLnQwoEzXNgrafQr3YNJtEsr4JuaY3ifNM4Lrs55hcc');

    xit('Listing token with SOL', async () => {
      // get this mint from mins-sft
      const mint = new PublicKey('HYKzXvsCcM6gUyUhgGF2Cx72nrsyM82EKNeyD3GQtRy8');
      const projectId = 38475;
      const sourceAta = getAssociatedTokenAddressSync(mint, upgradableAuthority.publicKey);

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

      const listingArgs: ListingArgs = {
        amount: 10,
        price: 0.1,
        projectId: projectId,
        currency: USDC,
      };

      const currencyAta = getAssociatedTokenAddressSync(USDC, upgradableAuthority.publicKey);

      const checkAtaAccount = await connection.getAccountInfo(currencyAta);

      const listingIns = await program.methods
        .listing(listingArgs)
        .accounts({
          signer: upgradableAuthority.publicKey,
          mint: mint,
          sourceAta: sourceAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      const tx = new Transaction();

      if (!checkAtaAccount) {
        // add this to txn
        const createAtaIns = createAssociatedTokenAccountInstruction(
          upgradableAuthority.publicKey,
          currencyAta,
          upgradableAuthority.publicKey,
          USDC,
        );

        tx.add(createAtaIns);
      }

      tx.add(listingIns);

      tx.feePayer = upgradableAuthority.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await anchorProvider.sendAndConfirm(tx, [], { skipPreflight: true });

      console.log('Tx: ', sig);
    });

    xit('Buying token with SOL', async () => {
      const buyer = Keypair.generate();
      const mint = new PublicKey('2Yk7gycCaLtViSPAPcAEUxQF82pCKqCWZEfLKSkfbvEH');
      const token_owner = upgradableAuthority.publicKey;

      await createAccount({
        provider: anchorProvider,
        newAccountKeypair: buyer,
        lamports: LAMPORTS_PER_SOL / 10,
      });

      const tokenListingInfo = new PublicKey('CoyaRchmX636aUexdxPZ1jidk2S2iRGCNv5brf42mR1P');

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

      const tokenListingInfo = new PublicKey('J6T1jPahnX5FCoAHbzHaCxPSx6qkiKhR6FqsKxvxNfqL');

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

    xit('Buying token with USDT', async () => {
      const USDT = new PublicKey('AxuH66zrimRg9NVbvdL8kptHRNWqGx2cb5Dk23SwbaHz');
      const buyer = Keypair.generate();
      const mint = new PublicKey('38iVZfDeATuKHtxyw12zPUtosDVmZgemFwq7kn5hNj8x');
      const token_owner = new PublicKey('HbHM8X9Eg8t7YsZ9dKRxVr9kXhunWEyUiNdCUBcHMhoB');

      await createAccount({
        provider: anchorProvider,
        newAccountKeypair: buyer,
        lamports: LAMPORTS_PER_SOL / 10,
      });

      // const sourceAtaToken = getAssociatedTokenAddressSync(USDC, buyer.publicKey);
      const destinationAtaToken = getAssociatedTokenAddressSync(USDT, token_owner);

      const testing = getAssociatedTokenAddressSync(USDT, upgradableAuthority.publicKey);

      const payer = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
      console.log('Payer: ', payer.publicKey);

      const sourceAtaToken = (await getOrCreateAssociatedTokenAccount(connection, payer, USDT, buyer.publicKey))
        .address;

      const sigTransfer = await transferChecked(
        connection,
        payer,
        testing,
        USDT,
        sourceAtaToken,
        upgradableAuthority.publicKey,
        20 * 10 ** 9,
        9,
        [],
        { skipPreflight: true },
      );

      console.log('Transfer USDT: ', sigTransfer);

      const tokenListingInfo = new PublicKey('41k8uTCLfsKLZXJEBthzMrCGr8UdYV68eYGWFohr9WDT');

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
            pubkey: USDT,
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

    it('Cancel listing', async () => {
      const mint = new PublicKey('HYKzXvsCcM6gUyUhgGF2Cx72nrsyM82EKNeyD3GQtRy8');
      const signer = upgradableAuthority.publicKey;
      const sourceAta = getAssociatedTokenAddressSync(mint, signer);

      const tx = await program.methods
        .cancelListing()
        .accounts({
          signer,
          mint,
          sourceAta,
        })
        .rpc({
          skipPreflight: true,
        });

      console.log('Txn: ', tx);
    });

    xit('Create collection', async () => {
      const [collectionPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('Collection')],
        program.programId,
      );

      const collectionTokenAccount = getAssociatedTokenAddressSync(collectionPDA, upgradableAuthority.publicKey);

      const [collectionMetadataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata', 'utf8'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), collectionPDA.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID,
      );

      const [collectionMasterEditionPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata', 'utf8'),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          collectionPDA.toBuffer(),
          Buffer.from('edition', 'utf8'),
        ],
        TOKEN_METADATA_PROGRAM_ID,
      );

      const tx = await program.methods
        .createCollection(
          'https://arweave.net/eJX2Xi-wzkNh6zRXQsx9wEKTq3E6P5bdoZKvWQ3XHzE',
          'Dcarbon Collection',
          'DCC',
        )
        .accounts({
          signer: upgradableAuthority.publicKey,
          metadataAccount: collectionMetadataPDA,
          masterEdition: collectionMasterEditionPDA,
          tokenAccount: collectionTokenAccount,
        })
        .rpc({
          skipPreflight: true,
        });

      console.log('Create collection: ', tx);
    });

    xit('Mint NFT cert', async () => {
      const [burningRecord] = PublicKey.findProgramAddressSync(
        [Buffer.from('burning_record'), upgradableAuthority.publicKey.toBuffer()],
        program.programId,
      );

      const totalAmount = (await program.account.burningRecord.fetch(burningRecord)).totalAmount;

      console.log(totalAmount);

      const burningAmount = totalAmount > 1 ? totalAmount - 1 : totalAmount;

      const mint = Keypair.generate();

      const tokenAccount = getAssociatedTokenAddressSync(mint.publicKey, upgradableAuthority.publicKey);

      const [collectionPDA] = PublicKey.findProgramAddressSync([Buffer.from('Collection')], program.programId);

      const [collectionMetadataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata', 'utf8'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), collectionPDA.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID,
      );

      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata', 'utf8'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID,
      );

      const [collectionMasterEditionPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata', 'utf8'),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          collectionPDA.toBuffer(),
          Buffer.from('edition', 'utf8'),
        ],
        TOKEN_METADATA_PROGRAM_ID,
      );

      const [masterEditionPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata', 'utf8'),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.publicKey.toBuffer(),
          Buffer.from('edition', 'utf8'),
        ],
        TOKEN_METADATA_PROGRAM_ID,
      );

      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000,
      });

      const mintNftIns = await program.methods
        .mintNft(
          'https://arweave.net/eJX2Xi-wzkNh6zRXQsx9wEKTq3E6P5bdoZKvWQ3XHzE',
          'Dcarbon Cert',
          'DCT',
          burningAmount,
        )
        .accounts({
          signer: upgradableAuthority.publicKey,
          collectionMetadataAccount: collectionMetadataPDA,
          collectionMasterEdition: collectionMasterEditionPDA,
          nftMint: mint.publicKey,
          metadataAccount: metadataAccount,
          masterEdition: masterEditionPDA,
          tokenAccount: tokenAccount,
        })
        .instruction();

      const tx = new Transaction().add(modifyComputeUnits).add(mintNftIns);
      tx.feePayer = upgradableAuthority.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await anchorProvider.sendAndConfirm(tx, [mint], { skipPreflight: true });
      console.log('Sig: ', sig);
    });

    xit('Burn Sft to mint NFT', async () => {
      const mint = new PublicKey('CUqJNRDGD68Xm5L7B8fCQaYcg3BACD95JEFABcRMVJ8G');
      const burnAta = getAssociatedTokenAddressSync(mint, upgradableAuthority.publicKey);
      const amount = 1000;
      const [metadata] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID,
      );

      const tx = await program.methods
        .burnSft(amount)
        .accounts({
          signer: upgradableAuthority.publicKey,
          mintSft: mint,
          burnAta,
          metadataSft: metadata,
          tokenProgram: TOKEN_PROGRAM_ID,
          sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        })
        .rpc({
          skipPreflight: true,
        });

      console.log('Burn SFT: ', tx);
    });
  });

  xit('Create mint', async () => {
    console.log('Create mint');
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
      addresses: [
        TOKEN_PROGRAM_ID,
        SYSVAR_INSTRUCTIONS_PUBKEY,
        TOKEN_METADATA_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID,
        SystemProgram.programId,
      ],
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

    await program.methods
      .setMintingLimit(1000, 50.1)
      .accounts({
        signer: upgradableAuthority.publicKey,
      })
      .rpc({
        skipPreflight: true,
      });

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
