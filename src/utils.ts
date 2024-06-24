import Arweave from 'arweave';
import {Connection, Keypair, SystemProgram, Transaction} from "@solana/web3.js";
import {AnchorProvider} from "@coral-xyz/anchor";


export async function uploadData(metadata: any, isImage: boolean) {
    try {
        const arweave = Arweave.init({
            host: 'arweave.net',
            port: 443,
            protocol: 'https',
            timeout: 20000,
            logging: false,
        });

        const wallet = JSON.parse(process.env.VITE_ARWEAVE_KEY);
        const metadataRequest = JSON.stringify(metadata);

        const metadataTransaction = await arweave.createTransaction({
            data: isImage ? metadata : metadataRequest,
        });

        if (isImage) {
            metadataTransaction.addTag('Contet-Type', 'image/png');
        }
        await arweave.transactions.sign(metadataTransaction, wallet);

        await arweave.transactions.post(metadataTransaction);

        const metadataUrl = 'https://arweave.net/' + metadataTransaction.id;

        return {arweaveId: metadataUrl};
    } catch (error) {
        console.log(error);
        return {error: error};
    }
}

export const createAccount = async ({
                                        provider,
                                        newAccountKeypair,
                                        lamports,
                                    }: {
    provider: AnchorProvider
    newAccountKeypair: Keypair;
    lamports: number;
}) => {
    const dataLength = 0;

    const rentExemptionAmount =
        await provider.connection.getMinimumBalanceForRentExemption(dataLength);

    const createAccountIns = SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: newAccountKeypair.publicKey,
        lamports: rentExemptionAmount,
        space: dataLength,
        programId: SystemProgram.programId,
    });

    const transferIns = SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: newAccountKeypair.publicKey,
        lamports: lamports,
    });

    const tx = new Transaction().add(createAccountIns).add(transferIns);

    tx.feePayer = provider.wallet.publicKey;
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;

    const sig = await provider.sendAndConfirm(tx,[newAccountKeypair], {skipPreflight: true})

    console.log(
        `Create account ${newAccountKeypair.publicKey} with ${lamports} lamports: ${sig}`
    );
};