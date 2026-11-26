// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * TiketAman: tiket event sebagai token ERC-721 dengan aturan anti-calo.
 *
 * Tiga aturan yang dikunci di kontrak:
 *  1. Batas harga jual ulang: faceValue * maxResaleBps / 10000 (ditetapkan saat createEvent, tidak bisa diubah)
 *  2. Batas kepemilikan per alamat per event (maxPerAddress)
 *  3. Tiket yang sudah dipakai (check-in) tidak bisa dipakai lagi maupun dijual
 *
 * Transfer biasa (transferFrom / safeTransferFrom) dinonaktifkan. Kepemilikan hanya
 * berpindah lewat executeResale, yang memeriksa batas harga.
 *
 * Model kepercayaan (prototipe): backend platform adalah owner kontrak dan memanggil
 * fungsi atas nama pengguna, karena pengguna memakai wallet custodial tanpa gas.
 * Harga dalam rupiah (bilangan bulat), karena pembayaran terjadi off-chain lewat Midtrans.
 */
contract TiketAman is ERC721, Ownable {
    struct EventConfig {
        uint256 faceValue;      // harga nominal (rupiah)
        uint32 capacity;        // jumlah tiket maksimal
        uint32 minted;          // jumlah tiket yang sudah dicetak
        uint16 maxResaleBps;    // 11000 = 110% dari harga nominal
        uint8 maxPerAddress;    // batas tiket per alamat
        address organizer;      // penyelenggara (penerima bagian resale)
        bool exists;
    }

    /// Bagian penyelenggara dari selisih harga resale di atas nominal: 50%
    uint256 public constant ORGANIZER_SHARE_BPS = 5000;

    uint256 public eventCount;
    uint256 private _nextTokenId = 1;

    mapping(uint256 eventId => EventConfig) public eventInfo;
    mapping(uint256 tokenId => uint256 eventId) public ticketEvent;
    mapping(uint256 tokenId => bool) public used;
    mapping(uint256 tokenId => uint256 priceIdr) public listingPrice; // 0 = tidak dijual
    mapping(uint256 eventId => mapping(address holder => uint256)) public held;

    event EventCreated(uint256 indexed eventId, uint256 faceValue, uint32 capacity, uint8 maxPerAddress, uint16 maxResaleBps, address organizer);
    event TicketMinted(uint256 indexed eventId, uint256 indexed tokenId, address indexed to);
    event ResaleListed(uint256 indexed tokenId, address indexed seller, uint256 priceIdr);
    event ResaleCancelled(uint256 indexed tokenId);
    event ResaleExecuted(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 priceIdr, uint256 organizerShare);
    event TicketUsed(uint256 indexed tokenId, address indexed holder);

    error TransferDisabled();
    error InvalidConfig();
    error UnknownEvent();
    error SoldOut();
    error QuotaExceeded();
    error PriceAboveCap(uint256 price, uint256 cap);
    error ZeroPrice();
    error AlreadyUsed();
    error AlreadyListed();
    error NotListed();
    error SelfPurchase();

    constructor() ERC721("TiketAman", "TKTA") Ownable(msg.sender) {}

    // ---------------------------------------------------------------- event

    function createEvent(
        uint256 faceValue,
        uint32 capacity,
        uint8 maxPerAddress,
        uint16 maxResaleBps,
        address organizer
    ) external onlyOwner returns (uint256 eventId) {
        if (faceValue == 0 || capacity == 0 || maxPerAddress == 0 || organizer == address(0)) revert InvalidConfig();
        if (maxResaleBps < 10000 || maxResaleBps > 20000) revert InvalidConfig(); // 100% sampai 200%

        eventId = ++eventCount;
        eventInfo[eventId] = EventConfig({
            faceValue: faceValue,
            capacity: capacity,
            minted: 0,
            maxResaleBps: maxResaleBps,
            maxPerAddress: maxPerAddress,
            organizer: organizer,
            exists: true
        });
        emit EventCreated(eventId, faceValue, capacity, maxPerAddress, maxResaleBps, organizer);
    }

    /// Harga jual ulang tertinggi yang diizinkan untuk event ini
    function maxResalePrice(uint256 eventId) public view returns (uint256) {
        EventConfig storage ev = eventInfo[eventId];
        if (!ev.exists) revert UnknownEvent();
        return (ev.faceValue * ev.maxResaleBps) / 10000;
    }

    // ----------------------------------------------------------------- mint

    /// Dipanggil backend setelah webhook pembayaran sukses
    function mintTicket(uint256 eventId, address to) external onlyOwner returns (uint256 tokenId) {
        EventConfig storage ev = eventInfo[eventId];
        if (!ev.exists) revert UnknownEvent();
        if (ev.minted >= ev.capacity) revert SoldOut();
        if (held[eventId][to] >= ev.maxPerAddress) revert QuotaExceeded();

        ev.minted += 1;
        tokenId = _nextTokenId++;
        ticketEvent[tokenId] = eventId; // harus diset sebelum _mint karena dipakai di _update
        _mint(to, tokenId);
        emit TicketMinted(eventId, tokenId, to);
    }

    // --------------------------------------------------------------- resale

    function listTicket(uint256 tokenId, uint256 priceIdr) external onlyOwner {
        address seller = _requireOwned(tokenId);
        if (used[tokenId]) revert AlreadyUsed();
        if (listingPrice[tokenId] != 0) revert AlreadyListed();
        if (priceIdr == 0) revert ZeroPrice();

        uint256 cap = maxResalePrice(ticketEvent[tokenId]);
        if (priceIdr > cap) revert PriceAboveCap(priceIdr, cap);

        listingPrice[tokenId] = priceIdr;
        emit ResaleListed(tokenId, seller, priceIdr);
    }

    function cancelListing(uint256 tokenId) external onlyOwner {
        if (listingPrice[tokenId] == 0) revert NotListed();
        listingPrice[tokenId] = 0;
        emit ResaleCancelled(tokenId);
    }

    /// Dipanggil backend setelah pembeli resale membayar lewat Midtrans
    function executeResale(uint256 tokenId, address buyer) external onlyOwner {
        uint256 price = listingPrice[tokenId];
        if (price == 0) revert NotListed();
        address seller = _requireOwned(tokenId);
        if (buyer == seller) revert SelfPurchase();
        if (used[tokenId]) revert AlreadyUsed();

        uint256 eventId = ticketEvent[tokenId];
        EventConfig storage ev = eventInfo[eventId];
        if (held[eventId][buyer] >= ev.maxPerAddress) revert QuotaExceeded();

        listingPrice[tokenId] = 0;
        _transfer(seller, buyer, tokenId); // internal, tidak terkena pemblokiran transferFrom

        uint256 organizerShare = 0;
        if (price > ev.faceValue) {
            organizerShare = ((price - ev.faceValue) * ORGANIZER_SHARE_BPS) / 10000;
        }
        emit ResaleExecuted(tokenId, seller, buyer, price, organizerShare);
    }

    // -------------------------------------------------------------- check-in

    /// Dipanggil backend saat QR valid dipindai di pintu masuk
    function markUsed(uint256 tokenId) external onlyOwner {
        address holder = _requireOwned(tokenId);
        if (used[tokenId]) revert AlreadyUsed();
        used[tokenId] = true;
        listingPrice[tokenId] = 0;
        emit TicketUsed(tokenId, holder);
    }

    // ------------------------------------------------------------ overrides

    /// Transfer langsung dinonaktifkan; safeTransferFrom juga memanggil fungsi ini
    function transferFrom(address, address, uint256) public pure override {
        revert TransferDisabled();
    }

    /// Menjaga hitungan tiket per alamat per event pada mint dan transfer
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        uint256 eventId = ticketEvent[tokenId];
        if (from != address(0)) held[eventId][from] -= 1;
        if (to != address(0)) held[eventId][to] += 1;
    }
}
