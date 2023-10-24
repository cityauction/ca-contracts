// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC721, ERC721Royalty} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ICityMarket {
    function updateCityOfferAfterTransfer(uint256 tokenId) external;

    function citiesOfferedForSale(uint256 tokenId) external returns (bool);
}

contract CityNFT is ERC721Royalty, Ownable {
    event AuctionCreated(uint256 indexed tokenId, uint256 reservePrice, uint256 endTime);
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 bidAmount);
    event AuctionEnded(uint256 indexed tokenId, address indexed winner, uint256 winningBid);
    enum AuctionStatus {
        pending, // not open for auction
        ongoing, // auction ongoing
        ended //auction ended
    }
    struct Auction {
        uint256 tokenId; // NFT ID
        string city;
        uint256 reservePrice; // starting price
        uint256 endTime; // last auction end time
        uint256 topBid; // highest bid price
        address topBidder; // top bidder
        uint256 latestBidTime; //most recent bid time
    }
    uint256 public constant AUCTION_DURATION = 1 days; // city auction lasts for 1 day
    uint256 public constant AUCTION_INTERVAL = 90 days; // auction interval is 90 days

    mapping(uint256 => Auction) public auctions; // cityID => auction

    ICityMarket public cityMarket;

    constructor(address _receiver, uint96 feeNumerator) ERC721("City", "city") {
        _setDefaultRoyalty(_receiver, feeNumerator);
    }

    function setCityMarket(address _cityMarket) external onlyOwner {
        cityMarket = ICityMarket(_cityMarket);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function getAuctionStatus(uint256 _tokenId) public view returns (AuctionStatus) {
        // city is put up for auction after every 3 month；
        // ongoing auction；
        Auction storage auction = auctions[_tokenId];
        require(auctions[_tokenId].endTime != 0, "Auction not exists for this NFT");

        uint256 diff = block.timestamp - auction.endTime;
        if (diff > AUCTION_INTERVAL && diff < (AUCTION_INTERVAL + AUCTION_DURATION)) {
            return AuctionStatus.ongoing;
        }

        if (diff > (AUCTION_INTERVAL + AUCTION_DURATION)) {
            if (auction.topBid > 0) {
                uint256 day = (auction.latestBidTime - auction.endTime) / AUCTION_DURATION;
                if ((auction.endTime + (day + 1) * AUCTION_DURATION) < block.timestamp) {
                    return AuctionStatus.ended;
                }
            }
            // auction failed
            return AuctionStatus.ongoing;
        }
        return AuctionStatus.pending;
    }

    // create a new auction
    function createAuction(
        uint256 _tokenId,
        uint256 _reservePrice,
        string memory _city
    ) external onlyOwner {
        require(_reservePrice > 0, "Reserve price must be greater than zero");
        require(auctions[_tokenId].endTime == 0, "Auction already exists for this NFT");
        auctions[_tokenId] = Auction({
            tokenId: _tokenId,
            city: _city,
            reservePrice: _reservePrice,
            endTime: block.timestamp - AUCTION_INTERVAL,
            topBid: 0,
            topBidder: address(0),
            latestBidTime: 0
        });
        emit AuctionCreated(_tokenId, _reservePrice, auctions[_tokenId].endTime);
    }

    // place a bid
    function placeBid(uint256 _tokenId) external payable {
        Auction storage auction = auctions[_tokenId];
        require(auctions[_tokenId].endTime != 0, "Auction not exists for this NFT");
        AuctionStatus status = getAuctionStatus(_tokenId);
        require(status != AuctionStatus.pending, "Auction has not started yet");
        require(status != AuctionStatus.ended, "Auction has ended");
        require(msg.value > auction.reservePrice, "Bid must be greater than reserve price");
        require(msg.value > auction.topBid, "Bid must be greater than topBid price");

        if (auction.topBid > 0) {
            (bool success, ) = auction.topBidder.call{value: auction.topBid}("");
            require(success, "Unable to send to last topBidder ");
        }
        auction.topBidder = msg.sender;
        auction.topBid = msg.value;
        auction.latestBidTime = block.timestamp;
        emit BidPlaced(_tokenId, msg.sender, msg.value);
    }

    // end an auction, winner gets NFT

    function endAuction(uint256 _tokenId) external {
        Auction storage auction = auctions[_tokenId];
        require(auctions[_tokenId].endTime != 0, "Auction not exists for this NFT");
        AuctionStatus status = getAuctionStatus(_tokenId);
        require(status == AuctionStatus.ended, "Auction has not ended");

        (address royaltyReceiver, uint256 royaltyAmount) = royaltyInfo(_tokenId, auction.topBid);
        if (_exists(_tokenId)) {
            address owner = ownerOf(_tokenId);
            (bool success1, ) = royaltyReceiver.call{value: royaltyAmount}("");
            (bool success2, ) = owner.call{value: auction.topBid - royaltyAmount}("");
            require(success1 && success2, "Unable to send to royaltyReceiver or owner");
            _transfer(owner, auction.topBidder, _tokenId);
        } else {
            (bool success, ) = royaltyReceiver.call{value: auction.topBid}("");
            require(success, "Unable to send to royaltyReceiver");
            _mint(auction.topBidder, _tokenId);
        }
        emit AuctionEnded(_tokenId, auction.topBidder, auction.topBid);
        auction.endTime = block.timestamp;
        auction.reservePrice = (auction.topBid * auction.topBid) / (auction.topBid - royaltyAmount);
        auction.topBid = 0;
        auction.topBidder = address(0);
        auction.latestBidTime = 0;
    }

    function getPlaceName(uint256 _tokenId) external view returns (string memory) {
        require(_exists(_tokenId), "Token ID does not exist");
        return auctions[_tokenId].city;
    }

    function exists(uint256 _tokenId) external view returns (bool) {
        return _exists(_tokenId);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721) {
        super._afterTokenTransfer(from, to, tokenId);
        if (from != to && address(cityMarket) != address(0)) {
            cityMarket.updateCityOfferAfterTransfer(tokenId);
        }
    }

    function approve(address to, uint256 tokenId) public virtual override {
        if (to != address(cityMarket) && address(cityMarket) != address(0)) {
            require(!cityMarket.citiesOfferedForSale(tokenId), "cancel sale first");
        }
        super.approve(to, tokenId);
    }
}
