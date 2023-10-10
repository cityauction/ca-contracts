// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC721, ERC721Royalty} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract CityNFT is ERC721Royalty, Ownable {
    event AuctionCreated(uint256 indexed tokenId, uint256 reservePrice, uint256 endTime);
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 bidAmount);
    event AuctionEnded(uint256 indexed tokenId, address indexed winner, uint256 winningBid);
    enum AuctionStatus {
        pending, // 等待期
        progress, // 拍卖进行中
        ended //拍卖结束
    }
    struct Auction {
        uint256 tokenId; // NFT的ID
        uint256 reservePrice; // 保留价
        uint256 endTime; // 上次拍卖结束时间
        uint256 topBid; // 最高出价
        address topBidder; // 最高出价人
        uint256 latestBidTime; //最新出价时间
    }
    uint256 public constant AUCTION_DURATION = 1 days; // 拍卖周期为1天
    uint256 public constant AUCTION_INTERVAL = 90 days; // 三个月一个拍卖周期
    // 存储每个拍卖的信息
    mapping(uint256 => Auction) public auctions;

    constructor(address _receiver, uint96 feeNumerator) ERC721("City", "city") {
        _setDefaultRoyalty(_receiver, feeNumerator);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }


    function getAuctionStatus(uint256 _tokenId) public view returns (AuctionStatus) {
        // 3个月等待期；
        // 拍卖中；
        Auction storage auction = auctions[_tokenId];
        require(auctions[_tokenId].endTime != 0, "Auction not exists for this NFT");

        uint256 diff = block.timestamp - auction.endTime;
        if (diff > AUCTION_INTERVAL && diff < (AUCTION_INTERVAL + AUCTION_DURATION)) {
            return AuctionStatus.progress;
        }

        if (diff > (AUCTION_INTERVAL + AUCTION_DURATION)) {
            if (auction.topBid > 0) {
                uint256 day = (auction.latestBidTime - auction.endTime) / AUCTION_DURATION;
                if ((auction.endTime + (day + 1) * AUCTION_DURATION) < block.timestamp) {
                    return AuctionStatus.ended;
                }
            }
            // 流拍
            return AuctionStatus.progress;
        }
        return AuctionStatus.pending;
    }

    // 创建一个新的NFT拍卖
    function createAuction(uint256 _tokenId, uint256 _reservePrice) external {
        require(_reservePrice > 0, "Reserve price must be greater than zero");
        require(auctions[_tokenId].endTime == 0, "Auction already exists for this NFT");
        auctions[_tokenId] = Auction({
            tokenId: _tokenId,
            reservePrice: _reservePrice,
            endTime: block.timestamp - AUCTION_INTERVAL,
            topBid: 0,
            topBidder: address(0),
            latestBidTime: 0
        });
        emit AuctionCreated(_tokenId, _reservePrice, auctions[_tokenId].endTime);
    }

    // 提交一个拍卖出价
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

    // 结束拍卖并处理NFT
    function endAuction(uint256 _tokenId) external {
        Auction storage auction = auctions[_tokenId];
        require(auctions[_tokenId].endTime != 0, "Auction not exists for this NFT");
        AuctionStatus status = getAuctionStatus(_tokenId);
        require(status == AuctionStatus.ended, "Auction has not yet ended");
        (address royaltyReceiver, uint256 royaltyAmount)=royaltyInfo(_tokenId,auction.topBid);
        if (_exists(_tokenId)) {
            address owner = ownerOf(_tokenId);
            (bool success1, ) = royaltyReceiver.call{value: royaltyAmount}("");
            (bool success2, ) = owner.call{value:auction.topBid-royaltyAmount}("");
            require(success1&&success2, "Unable to send to royaltyReceiver or owner");
            _transfer(owner, auction.topBidder, _tokenId);
        } else {
            (bool success, ) = royaltyReceiver.call{value: auction.topBid}("");
            require(success, "Unable to send to royaltyReceiver");
            _mint(auction.topBidder, _tokenId);
        }
        emit AuctionEnded(_tokenId, auction.topBidder, auction.topBid);
        auctions[_tokenId] = Auction({
            tokenId: _tokenId,
            reservePrice: auction.topBid*auction.topBid/(auction.topBid-royaltyAmount),
            endTime: block.timestamp,
            topBid: 0,
            topBidder: address(0),
            latestBidTime: 0
        });
        
    }
}
