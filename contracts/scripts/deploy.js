const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Network  :', hre.network.name);
  console.log('Deployer :', deployer.address);
  console.log('Saldo    :', hre.ethers.formatEther(balance), 'ETH');

  const factory = await hre.ethers.getContractFactory('TiketAman');
  const ticket = await factory.deploy();
  await ticket.waitForDeployment();
  const address = await ticket.getAddress();
  console.log('\nTiketAman ter-deploy di:', address);

  // Simpan ABI untuk dipakai backend (Tahap 5)
  const artifact = await hre.artifacts.readArtifact('TiketAman');
  const abiPath = path.resolve(__dirname, '../../backend/src/abi/TiketAman.json');
  fs.mkdirSync(path.dirname(abiPath), { recursive: true });
  fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
  console.log('ABI disimpan ke backend/src/abi/TiketAman.json');

  if (hre.network.name === 'sepolia') {
    console.log('\nLihat di Etherscan: https://sepolia.etherscan.io/address/' + address);
    console.log('Langkah berikut: isi CONTRACT_ADDRESS=' + address + ' di backend/.env');
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
