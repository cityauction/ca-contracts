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
    }

    mapping(uint256 => Offer) public citiesOfferedForSale;
    mapping(uint256 => Bid) public cityBids;

    constructor(address _nftContract) {
        nftContract = ERC721Royalty(_nftContract);
    }

    // 处理 nft owner 发生转移 取消挂单
    function updateCityOfferAfterTransfer(uint256 tokenId) public {
        require(address(msg.sender)==address(nftContract),'');
        Offer storage offer = citiesOfferedForSale[tokenId];
        if(offer.isForSale){
            citiesOfferedForSale[tokenId]=Offer(false, tokenId, nftContract.ownerOf(tokenId), 0, address(0));
        }
    }

    function offerCityForSale(uint256 tokenId, uint256 minSalePriceInWei) public {
        require(nftContract.ownerOf(tokenId) == msg.sender, "");
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
        require(nftContract.ownerOf(tokenId) == msg.sender, "");
         citiesOfferedForSale[tokenId] = Offer(
            true,
            tokenId,
            msg.sender,
            minSalePriceInWei,
            toAddress
        );
    }

    function cityNoLongerForSale(uint256 tokenId) public {
        require(nftContract.ownerOf(tokenId) == msg.sender, "");
        citiesOfferedForSale[tokenId] = Offer(false, tokenId, msg.sender, 0, address(0));
    }

    function buyCity(uint256 tokenId) public payable {
        Offer storage offer = citiesOfferedForSale[tokenId];
        require(offer.isForSale, "");
        require(!(offer.onlySellTo != address(0) && offer.onlySellTo != msg.sender), "");
        require(msg.value >= offer.minValue, "");

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
        require(nftContract.ownerOf(tokenId) != address(0), "");
        require(nftContract.ownerOf(tokenId) != msg.sender, "");
        require(msg.value > 0, "");
        Bid storage existing = cityBids[tokenId];
        require(msg.value > existing.value, "");
        if (existing.value > 0) {
            // Refund the failing bid
            (bool success, ) = existing.bidder.call{value: existing.value}("");
            require(success, "Unable to send to existing bidder");
        }
        cityBids[tokenId] = Bid(true, tokenId, msg.sender, msg.value);
    }

    function cnacelBidForCity(uint256 tokenId) public {
        require(nftContract.ownerOf(tokenId) != address(0), "");
        Bid storage bid = cityBids[tokenId];
        require(bid.bidder == msg.sender, "");
        if (bid.value > 0) {
            (bool success, ) = bid.bidder.call{value: bid.value}("");
            require(success, "Unable to send to  bidder");
        }
        cityBids[tokenId] = Bid(false, tokenId, address(0), 0);
    }

    // 直接成交
    function acceptBidForCity(uint256 tokenId, uint256 minPrice) public {
        require(nftContract.ownerOf(tokenId) != msg.sender, "");
        address seller = msg.sender;
        Bid storage bid = cityBids[tokenId];
        require(bid.value > minPrice, "");
        (address royaltyReceiver, uint256 royaltyAmount) = nftContract.royaltyInfo(
            tokenId,
            bid.value
        );
        (bool success1, ) = royaltyReceiver.call{value: royaltyAmount}("");
        (bool success2, ) = seller.call{value: bid.value - royaltyAmount}("");
        require(success1 && success2, "Unable to send to royaltyReceiver or seller");
        nftContract.safeTransferFrom(seller, msg.sender, tokenId);

        citiesOfferedForSale[tokenId] = Offer(false, tokenId, bid.bidder, 0, address(0));
        cityBids[tokenId] = Bid(false, tokenId, address(0), 0);
    }
}
