# Smart Contract TiketAman

ERC-721 dengan aturan anti-calo (OpenZeppelin v5, Solidity 0.8.28, Hardhat).

## Perintah
```bash
npm install            # sekali saja
npm run compile
npm test               # unit test (jaringan lokal Hardhat, tanpa ETH)
npm run deploy:sepolia # butuh RPC_URL dan PLATFORM_PRIVATE_KEY di ../backend/.env
npm run demo:sepolia   # butuh CONTRACT_ADDRESS juga
```

## Fungsi utama
| Fungsi | Siapa | Fungsi |
|---|---|---|
| createEvent | owner (backend) | Mengunci harga, kuota, batas resale |
| mintTicket | owner | Cetak tiket setelah bayar sukses |
| listTicket | owner | Pasang resale, ditolak bila > batas harga |
| executeResale | owner | Pindah kepemilikan setelah pembeli bayar |
| markUsed | owner | Check-in, tiket jadi `used` |
| transferFrom | siapa pun | Selalu ditolak |
