const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers');

const FACE = 75000n;      // Rp75.000
const CAP = 5;            // kapasitas kecil agar mudah diuji
const MAX_PER = 4;
const BPS = 11000;        // batas resale 110%
const MAX_PRICE = (FACE * BigInt(BPS)) / 10000n; // 82.500

async function deployFixture() {
  const [owner, organizer, alya, raka, dimas] = await ethers.getSigners();
  const ticket = await (await ethers.getContractFactory('TiketAman')).deploy();
  await ticket.waitForDeployment();
  await ticket.createEvent(FACE, CAP, MAX_PER, BPS, organizer.address); // eventId = 1
  return { ticket, owner, organizer, alya, raka, dimas };
}

describe('TiketAman', () => {
  describe('createEvent', () => {
    it('menyimpan konfigurasi dan memancarkan event', async () => {
      const [, organizer] = await ethers.getSigners();
      const ticket = await (await ethers.getContractFactory('TiketAman')).deploy();
      await expect(ticket.createEvent(FACE, CAP, MAX_PER, BPS, organizer.address))
        .to.emit(ticket, 'EventCreated')
        .withArgs(1, FACE, CAP, MAX_PER, BPS, organizer.address);
      const cfg = await ticket.eventInfo(1);
      expect(cfg.faceValue).to.equal(FACE);
      expect(cfg.maxResaleBps).to.equal(BPS);
      expect(await ticket.maxResalePrice(1)).to.equal(MAX_PRICE);
    });

    it('menolak pemanggil selain owner', async () => {
      const { ticket, alya, organizer } = await loadFixture(deployFixture);
      await expect(ticket.connect(alya).createEvent(FACE, CAP, MAX_PER, BPS, organizer.address))
        .to.be.revertedWithCustomError(ticket, 'OwnableUnauthorizedAccount');
    });

    it('menolak konfigurasi tidak valid (batas resale di bawah 100%)', async () => {
      const { ticket, organizer } = await loadFixture(deployFixture);
      await expect(ticket.createEvent(FACE, CAP, MAX_PER, 9000, organizer.address))
        .to.be.revertedWithCustomError(ticket, 'InvalidConfig');
    });
  });

  describe('mintTicket', () => {
    it('mencetak token unik ke pembeli', async () => {
      const { ticket, alya, raka } = await loadFixture(deployFixture);
      await expect(ticket.mintTicket(1, alya.address)).to.emit(ticket, 'TicketMinted').withArgs(1, 1, alya.address);
      await ticket.mintTicket(1, raka.address);
      expect(await ticket.ownerOf(1)).to.equal(alya.address);
      expect(await ticket.ownerOf(2)).to.equal(raka.address);
    });

    it('menolak mint oleh bukan owner (pembeli tidak bisa cetak sendiri)', async () => {
      const { ticket, alya } = await loadFixture(deployFixture);
      await expect(ticket.connect(alya).mintTicket(1, alya.address))
        .to.be.revertedWithCustomError(ticket, 'OwnableUnauthorizedAccount');
    });

    it('membatasi kepemilikan 4 tiket per alamat', async () => {
      const { ticket, alya } = await loadFixture(deployFixture);
      for (let i = 0; i < MAX_PER; i++) await ticket.mintTicket(1, alya.address);
      await expect(ticket.mintTicket(1, alya.address)).to.be.revertedWithCustomError(ticket, 'QuotaExceeded');
    });

    it('menolak mint saat tiket habis', async () => {
      const { ticket, alya, raka } = await loadFixture(deployFixture);
      for (let i = 0; i < 4; i++) await ticket.mintTicket(1, alya.address);
      await ticket.mintTicket(1, raka.address); // tiket ke-5 (kapasitas 5)
      await expect(ticket.mintTicket(1, raka.address)).to.be.revertedWithCustomError(ticket, 'SoldOut');
    });
  });

  describe('transfer dinonaktifkan', () => {
    it('transferFrom ditolak, bahkan oleh pemilik tiket', async () => {
      const { ticket, alya, raka } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await expect(ticket.connect(alya).transferFrom(alya.address, raka.address, 1))
        .to.be.revertedWithCustomError(ticket, 'TransferDisabled');
    });

    it('safeTransferFrom juga ditolak', async () => {
      const { ticket, alya, raka } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await expect(
        ticket.connect(alya)['safeTransferFrom(address,address,uint256)'](alya.address, raka.address, 1)
      ).to.be.revertedWithCustomError(ticket, 'TransferDisabled');
    });
  });

  describe('resale', () => {
    it('menerima listing pada batas 110% tepat', async () => {
      const { ticket, alya } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await expect(ticket.listTicket(1, MAX_PRICE)).to.emit(ticket, 'ResaleListed').withArgs(1, alya.address, MAX_PRICE);
    });

    it('menolak listing di atas 110% (anti-calo)', async () => {
      const { ticket, alya } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await expect(ticket.listTicket(1, MAX_PRICE + 1n))
        .to.be.revertedWithCustomError(ticket, 'PriceAboveCap')
        .withArgs(MAX_PRICE + 1n, MAX_PRICE);
    });

    it('executeResale memindahkan kepemilikan dan mencatat bagian penyelenggara', async () => {
      const { ticket, alya, raka } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await ticket.listTicket(1, MAX_PRICE);
      // selisih 7.500, bagian penyelenggara 50% = 3.750
      await expect(ticket.executeResale(1, raka.address))
        .to.emit(ticket, 'ResaleExecuted')
        .withArgs(1, alya.address, raka.address, MAX_PRICE, 3750n);
      expect(await ticket.ownerOf(1)).to.equal(raka.address);
      expect(await ticket.held(1, alya.address)).to.equal(0);
      expect(await ticket.held(1, raka.address)).to.equal(1);
      expect(await ticket.listingPrice(1)).to.equal(0);
    });

    it('resale harga nominal: bagian penyelenggara 0', async () => {
      const { ticket, alya, raka } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await ticket.listTicket(1, FACE);
      await expect(ticket.executeResale(1, raka.address))
        .to.emit(ticket, 'ResaleExecuted')
        .withArgs(1, alya.address, raka.address, FACE, 0n);
    });

    it('executeResale menghormati batas 4 tiket per alamat pembeli', async () => {
      const { ticket, alya, raka } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address); // tokenId 1
      for (let i = 0; i < MAX_PER; i++) await ticket.mintTicket(1, raka.address); // raka sudah 4 (kapasitas 5 terpakai)
      await ticket.listTicket(1, FACE);
      await expect(ticket.executeResale(1, raka.address)).to.be.revertedWithCustomError(ticket, 'QuotaExceeded');
    });

    it('menolak executeResale untuk tiket yang tidak dijual', async () => {
      const { ticket, alya, raka } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await expect(ticket.executeResale(1, raka.address)).to.be.revertedWithCustomError(ticket, 'NotListed');
    });

    it('menolak pembelian oleh penjual sendiri', async () => {
      const { ticket, alya } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await ticket.listTicket(1, FACE);
      await expect(ticket.executeResale(1, alya.address)).to.be.revertedWithCustomError(ticket, 'SelfPurchase');
    });

    it('cancelListing membatalkan penjualan', async () => {
      const { ticket, alya, raka } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await ticket.listTicket(1, FACE);
      await ticket.cancelListing(1);
      await expect(ticket.executeResale(1, raka.address)).to.be.revertedWithCustomError(ticket, 'NotListed');
    });
  });

  describe('check-in (markUsed)', () => {
    it('menandai tiket terpakai dan menolak pemakaian kedua', async () => {
      const { ticket, alya } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await expect(ticket.markUsed(1)).to.emit(ticket, 'TicketUsed').withArgs(1, alya.address);
      expect(await ticket.used(1)).to.equal(true);
      await expect(ticket.markUsed(1)).to.be.revertedWithCustomError(ticket, 'AlreadyUsed');
    });

    it('tiket terpakai tidak bisa dijual', async () => {
      const { ticket, alya } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await ticket.markUsed(1);
      await expect(ticket.listTicket(1, FACE)).to.be.revertedWithCustomError(ticket, 'AlreadyUsed');
    });

    it('hanya owner (backend) yang dapat memanggil markUsed', async () => {
      const { ticket, alya } = await loadFixture(deployFixture);
      await ticket.mintTicket(1, alya.address);
      await expect(ticket.connect(alya).markUsed(1)).to.be.revertedWithCustomError(ticket, 'OwnableUnauthorizedAccount');
    });
  });
});
