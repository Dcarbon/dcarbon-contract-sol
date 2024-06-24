import * as anchor from "@coral-xyz/anchor";
import {AnchorProvider, IdlTypes, Program} from "@coral-xyz/anchor";
import {DcarbonContract} from "../target/types/dcarbon_contract";
import {
    BurnArgsArgs,
    CreateArgsArgs,
    CreatorArgs,
    getBurnArgsSerializer,
    getCreateArgsSerializer,
    getMintArgsSerializer,
    MintArgsArgs,
    MPL_TOKEN_METADATA_PROGRAM_ID,
    TokenStandard
} from '@metaplex-foundation/mpl-token-metadata'
import {percentAmount, publicKey, some} from "@metaplex-foundation/umi";
import {
    AddressLookupTableProgram,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    Transaction
} from "@solana/web3.js";
import {ASSOCIATED_PROGRAM_ID, associatedAddress, TOKEN_PROGRAM_ID} from "@coral-xyz/anchor/dist/cjs/utils/token";
import {generateRandomObjectId} from "./utils";
import {createAccount} from "../src/utils";

type Project = IdlTypes<DcarbonContract>['project']

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID.toString())

describe("dcarbon-contract", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.DcarbonContract as Program<DcarbonContract>;
    const anchorProvider = program.provider as AnchorProvider;

    xit("Register project", async () => {
        const [authority] = PublicKey.findProgramAddressSync([Buffer.from('authority')], program.programId)
        const creator: CreatorArgs = {
            address: publicKey(authority.toString()),
            verified: true,
            share: 100
        }

        const createArgsVec: CreateArgsArgs = {
            __kind: "V1",
            name: 'DCarbon Project Test',
            symbol: "DCPT",
            uri: 'https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY',
            sellerFeeBasisPoints: percentAmount(5.5),
            decimals: some(0),
            creators: [creator],
            tokenStandard: TokenStandard.FungibleAsset
        }

        const mint = Keypair.generate()

        const project: Project = {
            id: generateRandomObjectId(),
            mint: mint.publicKey,
            config: {}
        }

        const serialize = getCreateArgsSerializer()
        const data = serialize.serialize(createArgsVec)

        const [metadata] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.publicKey.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );

        // Add your test here.
        const tx = await program.methods.registerProject(project, Buffer.from(data))
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
                skipPreflight: true
            })

        console.log('Register project: ', tx)
    });

    xit("Create mint", async () => {
        const createArgsVec: CreateArgsArgs = {
            __kind: "V1",
            name: 'DCarbon Token',
            symbol: "DCPT",
            uri: 'https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY',
            sellerFeeBasisPoints: percentAmount(5.5),
            decimals: some(9),
            creators: null,
            tokenStandard: TokenStandard.Fungible
        }

        const mint = Keypair.generate()

        const serialize = getCreateArgsSerializer()
        const data = serialize.serialize(createArgsVec)

        const [metadata] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.publicKey.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );

        // Add your test here.
        const tx = await program.methods.createMint(Buffer.from(data))
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
                skipPreflight: true
            })

        console.log('Create mint: ', tx)
    });

    xit('Mint SFT', async () => {

        const {project, mint, metadata} = await registerProject()

        const mintArgs: MintArgsArgs = {
            __kind: "V1",
            amount: 1,
            authorizationData: null
        }

        const receiver = Keypair.generate()

        await createAccount({
            provider: anchorProvider,
            newAccountKeypair: receiver,
            lamports: 0.1 * LAMPORTS_PER_SOL
        })

        const toAta = associatedAddress({
            mint: mint.publicKey,
            owner: receiver.publicKey
        })

        const serialize = getMintArgsSerializer()
        const data = serialize.serialize(mintArgs)

        const tx = await program.methods.mintSft(project.id, Buffer.from(data))
            .accounts({
                signer: anchorProvider.wallet.publicKey,
                receiver: receiver.publicKey,
                toAta,
                mint: mint.publicKey,
                metadata: metadata,
                tokenProgram: TOKEN_PROGRAM_ID,
                sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
                tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                ataProgram: ASSOCIATED_PROGRAM_ID
            })
            .rpc({
                skipPreflight: true
            })

        console.log('Mint SFT: ', tx)
    })

    it('Transform SFT to FT', async () => {
        const fungibleToken = new PublicKey('f5p4t6kbLSH7zJnxg8fMcAh5aec5zgLBffkm5qP1koR')

        const {project, mint, metadata} = await registerProject()

        const mintArgs: MintArgsArgs = {
            __kind: "V1",
            amount: 1,
            authorizationData: null
        }

        const receiver = Keypair.generate()

        await createAccount({
            provider: anchorProvider,
            newAccountKeypair: receiver,
            lamports: 0.1 * LAMPORTS_PER_SOL
        })

        const toAta = associatedAddress({
            mint: mint.publicKey,
            owner: receiver.publicKey
        })

        const serialize = getMintArgsSerializer()
        const data = serialize.serialize(mintArgs)

        const tx = await program.methods.mintSft(project.id, Buffer.from(data))
            .accounts({
                signer: anchorProvider.wallet.publicKey,
                receiver: receiver.publicKey,
                toAta,
                mint: mint.publicKey,
                metadata: metadata,
                tokenProgram: TOKEN_PROGRAM_ID,
                sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
                tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                ataProgram: ASSOCIATED_PROGRAM_ID
            })
            .rpc({
                skipPreflight: true
            })

        console.log('Mint SFT: ', tx)

        const burnArgs: BurnArgsArgs = {
            __kind: 'V1',
            amount: 1
        }

        const toAta2 = associatedAddress({
            mint: fungibleToken,
            owner: receiver.publicKey
        })

        const [metadataFt] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                fungibleToken.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );

        const mintArgs2: MintArgsArgs = {
            __kind: "V1",
            amount: 10 ** 9,
            authorizationData: null
        }

        const transformIns = await program.methods
            .transform(Buffer.from(getBurnArgsSerializer().serialize(burnArgs)), Buffer.from(serialize.serialize(mintArgs2)))
            .accounts({
                signer: anchorProvider.wallet.publicKey,
                receiver: receiver.publicKey,
                burnAta: toAta,
                toAta: toAta2,
                mintSft: mint.publicKey,
                mintFt: fungibleToken,
                metadataSft: metadata,
                metadataFt: metadataFt,
                tokenProgram: TOKEN_PROGRAM_ID,
                sysvarProgram: SYSVAR_INSTRUCTIONS_PUBKEY,
                tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                ataProgram: ASSOCIATED_PROGRAM_ID
            })
            .signers([receiver])
            .instruction()

        const transactionV0 = new Transaction().add(transformIns)

        const sig = await anchorProvider.sendAndConfirm(transactionV0, [receiver], {
            skipPreflight: true,
        });

        console.log('Transform SFT to FT: ', sig)
    })

    xit('Create lookup Table', async () => {
        // Init lookup table adđress
        const slot = await anchorProvider.connection.getSlot();

        // Add 2 instruction to create lookupTableAddress and saved lookupTableAddress
        const [createLookupTableIns, lookupTableAddress] =
            AddressLookupTableProgram.createLookupTable({
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
                ASSOCIATED_PROGRAM_ID
            ],
        });

        const createLookupTableTx = new Transaction().add(createLookupTableIns)
            .add(extendInstruction);


        const createLookupTableSig = await anchorProvider.sendAndConfirm(createLookupTableTx, [], {
            skipPreflight: true,
        });

        console.log("Create lookup table sig: ", createLookupTableSig)
        console.log("Address lookup: ", lookupTableAddress)

    })

    const registerProject = async () => {
        const [authority] = PublicKey.findProgramAddressSync([Buffer.from('authority')], program.programId)
        const creator: CreatorArgs = {
            address: publicKey(authority.toString()),
            verified: true,
            share: 100
        }

        const createArgsVec: CreateArgsArgs = {
            __kind: "V1",
            name: 'DCarbon Project Test',
            symbol: "DCPT",
            uri: 'https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY',
            sellerFeeBasisPoints: percentAmount(5.5),
            decimals: some(0),
            creators: [creator],
            tokenStandard: TokenStandard.FungibleAsset
        }

        const mint = Keypair.generate()

        const projectId = generateRandomObjectId()

        const project: Project = {
            id: projectId,
            mint: mint.publicKey,
            config: {}
        }

        const serialize = getCreateArgsSerializer()
        const data = serialize.serialize(createArgsVec)


        const [metadata] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.publicKey.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );

        // Add your test here.
        const tx = await program.methods.registerProject(project, Buffer.from(data))
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
                skipPreflight: true
            })

        console.log('Register project: ', tx)

        return {
            project,
            mint,
            metadata,
        }
    }
});
