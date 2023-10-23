// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC721Royalty} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CityMarket is Ownable {
    ERC721Royalty public nftContract;

    struct Offer {
        bool isForSale;
        uint256 tokenId;
        address seller;
        uint256 minValue; // in ether
        address onlySellTo; // specify to sell only to a specific person
    }
    struct Bid {
        bool hasBid;
        uint256 tokenId;
        address bidder;
        uint256 value;
        uint256 bidAt;
    }

    uint256 public constant BID_DURATION = 1 hours; //

    mapping(uint256 => Offer) public citiesOfferedForSale;
    mapping(uint256 => Bid) public cityBids;

    constructor(address _nftContract) {
        nftContract = ERC721Royalty(_nftContract);
    }

    // 处理 nft owner 发生转移 取消挂单
    function updateCityOfferAfterTransfer(uint256 tokenId) public {
        require(
            address(msg.sender) == address(nftContract),
            "Only the NFT contract can call this function"
        );
        Offer storage offer = citiesOfferedForSale[tokenId];
        if (offer.isForSale) {
            citiesOfferedForSale[tokenId] = Offer(
                false,
                tokenId,
                nftContract.ownerOf(tokenId),
                0,
                address(0)
            );
        }
    }

    function offerCityForSale(uint256 tokenId, uint256 minSalePriceInWei) public {
        require(
            nftContract.ownerOf(tokenId) == msg.sender,
            "You can only offer a city you own for sale"
        );
        require(minSalePriceInWei > 0  , "gt 0");
        citiesOfferedForSale[tokenId] = Offer(
            true,
            tokenId,
            msg.sender,
            minSalePriceInWei,
            address(0)
        );
    }

    function offerCityForSaleToAddress(
        uint256 tokenId,
        uint256 minSalePriceInWei,
        address toAddress
    ) public {
        require(
            nftContract.ownerOf(tokenId) == msg.sender,
            "You can only offer a city you own for sale"
        );
        citiesOfferedForSale[tokenId] = Offer(
            true,
            tokenId,
            msg.sender,
            minSalePriceInWei,
            toAddress
        );
    }

    function cityNoLongerForSale(uint256 tokenId) public {
        require(nftContract.ownerOf(tokenId) == msg.sender, "not owner of city");
        citiesOfferedForSale[tokenId] = Offer(false, tokenId, msg.sender, 0, address(0));
    }

    function buyCity(uint256 tokenId) public payable {
        Offer storage offer = citiesOfferedForSale[tokenId];
        require(offer.isForSale, "not for sale");
        require(
            !(offer.onlySellTo != address(0) && offer.onlySellTo != msg.sender),
            "only sell to"
        );
        require(msg.value >= offer.minValue, "less than the minimum price");

        (address royaltyReceiver, uint256 royaltyAmount) = nftContract.royaltyInfo(
            tokenId,
            msg.value
        );
        address seller = offer.seller;
        (bool success1, ) = royaltyReceiver.call{value: royaltyAmount}("");
        (bool success2, ) = seller.call{value: msg.value - royaltyAmount}("");
        require(success1 && success2, "Unable to send to royaltyReceiver or seller");
        nftContract.safeTransferFrom(seller, msg.sender, tokenId);
        // resst
        citiesOfferedForSale[tokenId] = Offer(false, tokenId, msg.sender, 0, address(0));
    }

    function enterBidForCity(uint256 tokenId) public payable {
        require(nftContract.ownerOf(tokenId) != address(0), "City with this ID does not exist");
        require(nftContract.ownerOf(tokenId) != msg.sender, "You cannot bid on a city you own");
        require(msg.value > 0, "The sent ether is zero");
        Bid storage existing = cityBids[tokenId];
        require(msg.value > existing.value, "Your bid is lower than the current highest bid");
        if (existing.value > 0) {
            // Refund the failing bid
            (bool success, ) = existing.bidder.call{value: existing.value}("");
            require(success, "Failed to refund the existing bidder");
        }
        cityBids[tokenId] = Bid(true, tokenId, msg.sender, msg.value, block.timestamp);
    }

    function cnacelBidForCity(uint256 tokenId) public {
        require(nftContract.ownerOf(tokenId) != address(0), "City with this ID does not exist");
        Bid storage bid = cityBids[tokenId];
        require(bid.bidder == msg.sender, "You can only cancel your own bid");
        require(block.timestamp - bid.bidAt > BID_DURATION, "");
        if (bid.value > 0) {
            (bool success, ) = bid.bidder.call{value: bid.value}("");
            require(success, "Unable to send to  bidder");
        }
        cityBids[tokenId] = Bid(false, tokenId, address(0), 0, 0);
    }

    // 直接成交
    function acceptBidForCity(uint256 tokenId, uint256 minPrice) public {
        require(
            nftContract.ownerOf(tokenId) != msg.sender,
            "You cannot accept a bid on your own city"
        );
        address seller = msg.sender;
        Bid storage bid = cityBids[tokenId];
        require(bid.bidder != msg.sender, "You cannot accept your own bid");
        require(bid.value >= minPrice, "The bid value is lower than the minimum accepted price");
        (address royaltyReceiver, uint256 royaltyAmount) = nftContract.royaltyInfo(
            tokenId,
            bid.value
        );
        (bool success1, ) = royaltyReceiver.call{value: royaltyAmount}("");
        (bool success2, ) = seller.call{value: bid.value - royaltyAmount}("");
        require(success1 && success2, "Unable to send to royaltyReceiver or seller");
        nftContract.safeTransferFrom(seller, bid.bidder, tokenId);

        citiesOfferedForSale[tokenId] = Offer(false, tokenId, bid.bidder, 0, address(0));
        cityBids[tokenId] = Bid(false, tokenId, address(0), 0, 0);
    }
}
