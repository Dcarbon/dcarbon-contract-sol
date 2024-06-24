import {createUmi} from '@metaplex-foundation/umi-bundle-defaults'
import {
    burnV1,
    createFungible,
    createFungibleAsset,
    mplTokenMetadata,
    TokenStandard
} from '@metaplex-foundation/mpl-token-metadata'
import {
    createSignerFromKeypair,
    generateSigner,
    percentAmount,
    publicKey,
    signerIdentity,
    some
} from "@metaplex-foundation/umi";
import * as bs58 from 'bs58'
import * as dotenv from 'dotenv'
import {uploadData} from "./utils";
import metadata from './assets/metadata.json'
import * as path from "node:path";
import * as fs from "node:fs";

dotenv.config()

// Use the RPC endpoint of your choice.
const umi = createUmi(process.env.DEV_RPC_ENDPOINT).use(mplTokenMetadata())
const keypair = umi.eddsa.createKeypairFromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
const umiSigner = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(umiSigner));

const mintSFT = async () => {
    const mint = generateSigner(umi)
    await createFungibleAsset(umi, {
        mint,
        name: 'DCarbon Project 1',
        symbol: 'DCP1',
        uri: 'https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY',
        sellerFeeBasisPoints: percentAmount(5.5),
        decimals: some(0),
    }).sendAndConfirm(umi)

    // const mintPubkey = publicKey('49912SPjYgzU2UmLBcN1rmq8BHe8YgyYssPoxSPEYAaE')
    //
    // await mintV1(umi, {
    //     mint: mintPubkey, tokenStandard: TokenStandard.FungibleAsset, amount: 1
    //
    // }).sendAndConfirm(umi)
}

const createMint = async () => {
    const mint = generateSigner(umi)
    await createFungible(umi, {
        mint,
        name: 'My Fungible',
        uri: 'https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY',
        sellerFeeBasisPoints: percentAmount(5.5),
        decimals: some(7), // for 0 decimals use some(0)
    }).sendAndConfirm(umi)
}

// createMint()

const burnToken = async () => {
    const mintPubkey = publicKey('49912SPjYgzU2UmLBcN1rmq8BHe8YgyYssPoxSPEYAaE')
    await  burnV1(umi, {
        mint: mintPubkey,
        authority: umiSigner,
        tokenOwner: publicKey('Fxu7o9k8BKKAJyD94UfESH9sMrEFtoXtRRbQiiUFD1pv'),
        tokenStandard: TokenStandard.FungibleAsset,
        amount: 2
    }).sendAndConfirm(umi)
}

burnToken()
const uploadMetadata = async () => {
    // upload image
    const imagePath = path.join(__dirname, './assets/image.jpeg');
    let imageUrl;
    fs.readFile(imagePath, async (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        const {arweaveId} = await uploadData(data, true)
        imageUrl = arweaveId
        console.log(imageUrl)
    });
    // https://arweave.net/eJX2Xi-wzkNh6zRXQsx9wEKTq3E6P5bdoZKvWQ3XHzE

    // upload metdata
    const {arweaveId} = await uploadData({...metadata, image: imageUrl}, false)
    console.log(arweaveId)
    // https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY
}

// uploadMetadata()