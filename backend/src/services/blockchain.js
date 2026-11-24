const { ethers } = require('ethers');
const abi = require('../abi/TiketAman.json');

let cached = null;

function getContract() {
  const { RPC_URL, PLATFORM_PRIVATE_KEY, CONTRACT_ADDRESS } = process.env;
  if (!RPC_URL || !PLATFORM_PRIVATE_KEY || !CONTRACT_ADDRESS) {
    throw new Error('BLOCKCHAIN_NOT_CONFIGURED');
  }
  if (!cached) {
    const pk = PLATFORM_PRIVATE_KEY.startsWith('0x') ? PLATFORM_PRIVATE_KEY : `0x${PLATFORM_PRIVATE_KEY}`;
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(pk, provider);
    cached = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
  }
  return cached;
}

// Mengunci konfigurasi event (harga, kuota, batas resale) di smart contract
async function createEventOnChain({ faceValueIdr, capacity, maxPerUser, maxResaleBps, organizerAddress }) {
  const contract = getContract();
  const tx = await contract.createEvent(faceValueIdr, capacity, maxPerUser, maxResaleBps, organizerAddress);
  const receipt = await tx.wait();
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === 'EventCreated') {
        return { onchainEventId: Number(parsed.args.eventId), txHash: tx.hash };
      }
    } catch (_) { /* log dari kontrak lain, abaikan */ }
  }
  throw new Error('Event EventCreated tidak ditemukan pada transaksi');
}

module.exports = { createEventOnChain };
