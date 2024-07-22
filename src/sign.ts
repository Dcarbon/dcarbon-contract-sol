import * as ethSigUtil from 'eth-sig-util';

// Define the EIP-712 domain
const domain = {
  name: 'Carbon',
  version: '1',
  chainId: 1337,
  verifyingContract: '0x9C399C33a393334D28e8bA4FFF45296f50F82d1f',
  salt: '',
};

// Define the message
const message = {
  iot: '0x56b0dd1d96D5f0F7222f08656Ee641e2eAC7BF08',
  amount: '0x02cb417800',
  nonce: 1,
};

const types = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
    { name: 'salt', type: 'string' },
  ],
  Message: [
    { name: 'iot', type: 'string' },
    { name: 'amount', type: 'string' },
    { name: 'nonce', type: 'uint256' },
  ],
};

const privateKey = Buffer.from('07bb8829d8dd4f2d92b6369e15945da6cbea4c1ddb38f2a2559282649c482279', 'hex');

// Data to be signed
const data = {
  types,
  domain,
  primaryType: 'Message' as const,
  message,
};

const sig = ethSigUtil.signTypedData(privateKey, { data });
console.log(sig);
