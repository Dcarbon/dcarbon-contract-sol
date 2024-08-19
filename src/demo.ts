import * as dotenv from 'dotenv';
import metadata from './assets/metadata.json';
import { PutObjectCommand, PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3';

dotenv.config();

// // Use the RPC endpoint of your choice.
// const umi = createUmi(process.env.DEV_RPC_ENDPOINT).use(mplTokenMetadata())
// const keypair = umi.eddsa.createKeypairFromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
// const umiSigner = createSignerFromKeypair(umi, keypair);
// umi.use(signerIdentity(umiSigner));
//
// const mintSFT = async () => {
//     const mint = generateSigner(umi)
//     await createFungibleAsset(umi, {
//         mint,
//         name: 'DCarbon Project 1',
//         symbol: 'DCP1',
//         uri: 'https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY',
//         sellerFeeBasisPoints: percentAmount(5.5),
//         decimals: some(0),
//     }).sendAndConfirm(umi)
//
//     // const mintPubkey = publicKey('49912SPjYgzU2UmLBcN1rmq8BHe8YgyYssPoxSPEYAaE')
//     //
//     // await mintV1(umi, {
//     //     mint: mintPubkey, tokenStandard: TokenStandard.FungibleAsset, amount: 1
//     //
//     // }).sendAndConfirm(umi)
// }
//
// const createMint = async () => {
//     const mint = generateSigner(umi)
//     await createFungible(umi, {
//         mint,
//         name: 'My Fungible',
//         uri: 'https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY',
//         sellerFeeBasisPoints: percentAmount(5.5),
//         decimals: some(7), // for 0 decimals use some(0)
//     }).sendAndConfirm(umi)
// }
//
// const burnToken = async () => {
//     const mintPubkey = publicKey('49912SPjYgzU2UmLBcN1rmq8BHe8YgyYssPoxSPEYAaE')
//     await  burnV1(umi, {
//         mint: mintPubkey,
//         authority: umiSigner,
//         tokenOwner: publicKey('Fxu7o9k8BKKAJyD94UfESH9sMrEFtoXtRRbQiiUFD1pv'),
//         tokenStandard: TokenStandard.FungibleAsset,
//         amount: 2
//     }).sendAndConfirm(umi)
// }

const init = (): S3Client => {
  return new S3Client({
    region: process.env.AWS_REGION as string,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY as string,
      secretAccessKey: process.env.AWS_SECRET_KEY as string,
    },
  });
};

const upload = async (input: PutObjectCommandInput): Promise<string> => {
  const client = init();
  const command = new PutObjectCommand(input);

  await client.send(command);

  return `${process.env.AWS_S3_BUCKET_URL}/${input.Key}`;
};
export { upload };
//
// const uploadMetadataHehe = async (symbol: string): Promise<string> => {
//     const icon = fs.readFileSync("");
//     const iconPath = await upload({
//         Bucket: process.env.AWS_S3_BUCKET_NAME,
//         Key: `public/icons/spl-token/${symbol.toLowerCase()}.jpg`,
//         ContentType: 'image/jpg',
//         Body: icon,
//     });
//     const metadata = {
//         name: symbol,
//         symbol: symbol.toUpperCase(),
//         description: `${symbol} token`,
//         image: iconPath,
//     };
//     return await upload({
//         Bucket: process.env.AWS_S3_BUCKET_NAME,
//         Key: `public/metadata/spl-token/${symbol.toLowerCase()}.json`,
//         ContentType: 'application/json',
//         Body: JSON.stringify(metadata),
//     });
// };
const uploadMetadata = async () => {
  // // upload image
  // const data = fs.readFileSync('./src/assets/project_2.jpeg');
  // const iconPath = await upload({
  //     Bucket: process.env.AWS_S3_BUCKET_NAME,
  //     Key: `public/icons/spl-token/P2T.jpg`,
  //     ContentType: 'image/jpg',
  //     Body: data,
  // });
  // console.log(iconPath)
  // // https://arweave.net/eJX2Xi-wzkNh6zRXQsx9wEKTq3E6P5bdoZKvWQ3XHzE

  // // upload metdata
  // const {arweaveId} = await uploadData({...metadata, image: 'imageUrl'}, false)
  // console.log(arweaveId)
  // // https://arweave.net/3_vunO33xhGN7goIxE3G-RJgj-4vCwwZWSgM1QzVbAY

  const uri = await upload({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `public/metadata/spl-token/metadata_project_2.json`,
    ContentType: 'application/json',
    Body: JSON.stringify(metadata),
  });

  console.log(uri);
};

uploadMetadata();
