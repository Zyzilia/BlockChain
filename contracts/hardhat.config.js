require('@nomicfoundation/hardhat-toolbox');
const path = require('path');
// Memakai file .env yang sama dengan backend, supaya tidak ada dua tempat menyimpan rahasia
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const { RPC_URL, PLATFORM_PRIVATE_KEY } = process.env;
const pk = PLATFORM_PRIVATE_KEY
  ? PLATFORM_PRIVATE_KEY.startsWith('0x') ? PLATFORM_PRIVATE_KEY : `0x${PLATFORM_PRIVATE_KEY}`
  : null;

module.exports = {
  solidity: {
    version: '0.8.28',
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' },
  },
  networks: {
    sepolia: {
      url: RPC_URL || 'http://127.0.0.1:8545',
      accounts: pk ? [pk] : [],
    },
  },
};
