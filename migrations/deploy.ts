import anchor from '@coral-xyz/anchor';
import Provider from '@coral-xyz/anchor/dist/cjs/provider';

module.exports = async function (provider: Provider) {
  anchor.setProvider(provider);
};
