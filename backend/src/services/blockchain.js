const { ethers } = require('ethers');
const abi = require('../abi/TiketAman.json');
const { enqueue } = require('./chainQueue');

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

const isConfigured = () => !!(process.env.RPC_URL && process.env.PLATFORM_PRIVATE_KEY && process.env.CONTRACT_ADDRESS);

// Mencari log event tertentu pada receipt transaksi
function findEvent(contract, receipt, name) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === name) return parsed;
    } catch (_) { /* log dari kontrak lain, abaikan */ }
  }
  return null;
}

// Mengunci konfigurasi event (harga, kuota, batas resale) di smart contract
function createEventOnChain({ faceValueIdr, capacity, maxPerUser, maxResaleBps, organizerAddress }) {
  return enqueue(async () => {
    const contract = getContract();
    const tx = await contract.createEvent(faceValueIdr, capacity, maxPerUser, maxResaleBps, organizerAddress);
    const receipt = await tx.wait();
    const ev = findEvent(contract, receipt, 'EventCreated');
    if (!ev) throw new Error('Event EventCreated tidak ditemukan pada transaksi');
    return { onchainEventId: Number(ev.args.eventId), txHash: tx.hash };
  });
}

// Mencetak satu tiket (token ERC-721) ke alamat wallet pembeli.
// onTxSent dipanggil begitu hash transaksi ada, sebelum menunggu konfirmasi (untuk pemulihan bila server mati).
function mintTicketOnChain({ onchainEventId, to, onTxSent }) {
  return enqueue(async () => {
    const contract = getContract();
    const tx = await contract.mintTicket(onchainEventId, to);
    if (onTxSent) onTxSent(tx.hash);
    const receipt = await tx.wait();
    const ev = findEvent(contract, receipt, 'TicketMinted');
    if (!ev) throw new Error('Event TicketMinted tidak ditemukan pada transaksi');
    return { tokenId: Number(ev.args.tokenId), txHash: tx.hash };
  });
}

// Memeriksa transaksi mint yang hash-nya sudah tersimpan tetapi hasilnya belum dicatat
// (misalnya server mati saat menunggu konfirmasi). Mencegah mint ganda untuk satu tiket.
async function inspectMintTx(txHash) {
  const contract = getContract();
  const provider = contract.runner.provider;
  const receipt = await provider.getTransactionReceipt(txHash);
  if (receipt) {
    if (receipt.status !== 1) return { state: 'reverted' };
    const ev = findEvent(contract, receipt, 'TicketMinted');
    return ev ? { state: 'mined', tokenId: Number(ev.args.tokenId) } : { state: 'reverted' };
  }
  const tx = await provider.getTransaction(txHash);
  return { state: tx ? 'pending' : 'missing' };
}

// Membaca keadaan tiket langsung dari blockchain (bukti keaslian dan kepemilikan)
async function readTicketOnChain(tokenId) {
  const contract = getContract();
  try {
    const [owner, used, eventId] = await Promise.all([
      contract.ownerOf(tokenId),
      contract.used(tokenId),
      contract.ticketEvent(tokenId),
    ]);
    return { exists: true, owner, used, eventId: Number(eventId) };
  } catch (e) {
    if (e.code === 'CALL_EXCEPTION') return { exists: false }; // token tidak ada
    throw e;
  }
}

module.exports = { isConfigured, createEventOnChain, mintTicketOnChain, inspectMintTx, readTicketOnChain };
