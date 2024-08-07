import * as dotenv from 'dotenv';
import * as abi from 'ethereumjs-abi';
import * as ethUtil from 'ethereumjs-util';
import { ethers } from 'ethers';

dotenv.config();

// Define the data types
const types = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  primaryType: 'Mint',
  Mint: [
    { name: 'iot', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

function dependencies(primaryType: any, found = []) {
  if (found.includes(primaryType)) {
    return found;
  }
  if (types[primaryType] === undefined) {
    return found;
  }
  found.push(primaryType);
  for (const field of types[primaryType]) {
    for (const dep of dependencies(field.type, found)) {
      if (!found.includes(dep)) {
        found.push(dep);
      }
    }
  }
  return found;
}

function encodeType(primaryType: any) {
  // Get dependencies primary first, then alphabetical
  let deps = dependencies(primaryType);
  deps = deps.filter((t) => t != primaryType);
  deps = [primaryType].concat(deps.sort());

  // Format as a string with fields
  let result = '';
  for (const type of deps) {
    result += `${type}(${types[type].map(({ name, type }) => `${type} ${name}`).join(',')})`;
  }
  return result;
}

function typeHash(primaryType: any) {
  return ethUtil.keccakFromString(encodeType(primaryType), 256);
}

function encodeData(primaryType: any, data: any) {
  const encTypes = [];
  const encValues = [];

  // Add typehash
  encTypes.push('bytes32');
  encValues.push(typeHash(primaryType));

  // Add field contents
  for (const field of types[primaryType]) {
    let value = data[field.name];
    if (field.type == 'string' || field.type == 'bytes') {
      encTypes.push('bytes32');
      value = ethUtil.keccakFromString(value, 256);
      encValues.push(value);
    } else if (types[field.type] !== undefined) {
      encTypes.push('bytes32');
      value = ethUtil.keccak256(encodeData(field.type, value));
      encValues.push(value);
    } else if (field.type.lastIndexOf(']') === field.type.length - 1) {
      throw 'TODO: Arrays currently unimplemented in encodeData';
    } else {
      encTypes.push(field.type);
      encValues.push(value);
    }
  }

  return abi.rawEncode(encTypes, encValues);
}

export function structHash(primaryType: any, data: any) {
  return ethUtil.keccak256(encodeData(primaryType, data));
}

// const createTransaction = async (message: any, fullSig: string): Promise<void> => {
//   try {
//     // Define the EIP-712 domain
//     const domain = {
//       name: 'Carbon',
//       version: '1',
//       chainId: 1337,
//       verifyingContract: '0x9C399C33a393334D28e8bA4FFF45296f50F82d1f',
//     };
//
//     const fullSigBytes = ethers.utils.arrayify(fullSig);
//
//     const signature = fullSigBytes.slice(0, 64);
//
//     const recoveryId = fullSigBytes[64] - 27;
//
//     const prefix = Buffer.from('\x19\x01');
//
//     const messageHash = structHash(types.primaryType, message);
//
//     const domainSeparator = structHash('EIP712Domain', domain);
//
//     const actualMessage = Buffer.concat([prefix, domainSeparator, messageHash]);
//
//     const ethAddress = Buffer.from(message.iot, 'hex');
//
//     // struct to pass to createInstructionWithEthAddress
//     const example: CreateSecp256k1InstructionWithEthAddressParams = {
//       ethAddress: ethAddress,
//       message: actualMessage,
//       signature: signature,
//       recoveryId: recoveryId,
//     };
//
//     const connection = new Connection('https://api.testnet.solana.com', 'confirmed');
//
//     // create sender keypair
//     const sender = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
//
//     const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash();
//
//     const tx = new Transaction({
//       feePayer: sender.publicKey,
//       blockhash,
//       lastValidBlockHeight,
//     }).add(Secp256k1Program.createInstructionWithEthAddress(example));
//
//     tx.partialSign(sender);
//
//     const txnSig = await sendAndConfirmTransaction(connection, tx, [sender]);
//
//     console.log('Signature: ', txnSig);
//   } catch (e) {
//     console.log('Error: ', e.message);
//     console.error(e.stack);
//   }
// };

export const prepareParams = () => {
  const metadata = {
    iot: '0x4d0155c687739bce9440ffb8aba911b00b21ea56',
    amount: '0x00',
    nonce: 1,
    signed: 'skN4F+Ebh3ShbfySpMCy+zfyrz8VwYUzdDo6RD+Ed4I8ItawaFZ2MYGSRd/6yXALOeOqsNIzsiOBufCI3shh4xw=',
  };

  const fullSig = '0x' + Buffer.from(metadata.signed, 'base64').toString('hex');

  const message = {
    iot: metadata.iot,
    amount: metadata.amount,
    nonce: metadata.nonce,
  };

  try {
    // Define the EIP-712 domain
    const domain = {
      name: 'Carbon',
      version: '1',
      chainId: 1337,
      verifyingContract: '0x9C399C33a393334D28e8bA4FFF45296f50F82d1f',
    };

    const fullSigBytes = ethers.utils.arrayify(fullSig);

    const signature = fullSigBytes.slice(0, 64);

    const recoveryId = fullSigBytes[64] - 27;

    const prefix = Buffer.from('\x19\x01');

    const messageHash = structHash(types.primaryType, message);

    const domainSeparator = structHash('EIP712Domain', domain);

    const hashMessage = Buffer.concat([prefix, domainSeparator, messageHash]);

    const ethAddress = Buffer.from(message.iot.slice(2), 'hex');

    // struct to pass to createInstructionWithEthAddress
    return {
      ethAddress: ethAddress,
      message: hashMessage,
      signature: signature,
      recoveryId: recoveryId,
    };
  } catch (e) {
    console.log('Error: ', e.message);
    console.error(e.stack);
  }
};

// const main = async () => {
//   const metadata = {
//     iot: '0x4d0155c687739bce9440ffb8aba911b00b21ea56',
//     amount: '0x00',
//     nonce: 1,
//     signed: 'skN4F+Ebh3ShbfySpMCy+zfyrz8VwYUzdDo6RD+Ed4I8ItawaFZ2MYGSRd/6yXALOeOqsNIzsiOBufCI3shh4xw=',
//   };
//
//   const fullSig = '0x' + Buffer.from(metadata.signed, 'base64').toString('hex');
//
//   const msg = {
//     iot: metadata.iot,
//     amount: metadata.amount,
//     nonce: metadata.nonce,
//   };
//
//   await createTransaction(msg, fullSig);
// };

// main();

prepareParams();
