// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract CityPassNFT is ERC721, Ownable {
    // fee distribution
    address public protocolFeeDestination;
    address public holderAndReferralFeeDestination;
    uint256 public protocolFeePercent;
    uint256 public cityFeePercent;
    uint256 public holderFeePercent;
    uint256 public referralFeePercent;

    IERC721 public cityNFT; // cityNFT contract

    uint256 public tokenNum = 0; // minted amount of tokenId

    mapping(uint256 => uint256) public passCity; // tokenId => cityId store cityPass under specific city
    mapping(uint256 => uint256) public cityTokenCounts; // cityID => cityPass Counts
    mapping(uint256 => mapping(address => uint256)) public passBalance; // cityID => addr => cityPassCount

    constructor(address _cityNFT) ERC721("CityPassNFT", "CityPassNFT") {
        cityNFT = IERC721(_cityNFT);
    }

    function getPrice(uint256 supply, uint256 amount) public pure returns (uint256) {
        uint256 sum1 = supply == 0 ? 0 : ((supply - 1) * (supply) * (2 * (supply - 1) + 1)) / 6;
        uint256 sum2 = supply == 0 && amount == 1
            ? 0
            : ((supply - 1 + amount) * (supply + amount) * (2 * (supply - 1 + amount) + 1)) / 6;
        uint256 summation = sum2 - sum1;
        return (summation * 1 ether) / 16000;
    }

    function getPriceAndFee(
        uint256 supply,
        uint256 amount
    ) public view returns (uint256 price, uint256 protocolFee, uint256 cityFee, uint256 holderFee) {
        price = getPrice(supply, amount);
        protocolFee = (price * protocolFeePercent) / 1 ether;
        cityFee = (price * cityFeePercent) / 1 ether;
        holderFee = (price * holderFeePercent) / 1 ether;
    }

    function getMintPrices(uint256 cityId, uint256 amount) public view returns (uint256) {
        return getPrice(cityTokenCounts[cityId], amount);
    }

    function getBurnPrice(uint256 cityId, uint256 amount) public view returns (uint256) {
        return getPrice(cityTokenCounts[cityId] - amount, amount);
    }

    function getMintPriceAfterFee(uint256 cityId, uint256 amount) public view returns (uint256) {
        (uint256 price, uint256 protocolFee, uint256 cityFee, uint256 holderFee) = getPriceAndFee(
            cityTokenCounts[cityId],
            amount
        );
        return price + protocolFee + cityFee + holderFee;
    }

    function getBurnPriceAfterFee(uint256 cityId, uint256 amount) public view returns (uint256) {
        (uint256 price, uint256 protocolFee, uint256 cityFee, uint256 holderFee) = getPriceAndFee(
            cityTokenCounts[cityId] - amount,
            amount
        );
        return price - protocolFee - cityFee - holderFee;
    }

    function mintNFT(address to, uint256 cityId) internal {
        require(cityNFT.ownerOf(cityId) != address(0), "Token ID does not exist");
        tokenNum += 1;
        passCity[tokenNum] = cityId;
        _mint(to, tokenNum);
    }

    function burnNFT(uint256 tokenId) internal {
        require(_isApprovedOrOwner(msg.sender, tokenId), "You don't own this NFT");
        uint256 cityId = passCity[tokenId];
        require(cityTokenCounts[cityId] > 0, "Invalid cityId ID");
        _burn(tokenId); // burn citypass
    }

    function bulkMintNFT(uint256 cityId, uint256 amount) public payable {
        (uint256 price, uint256 protocolFee, uint256 cityFee, uint256 holderFee) = getPriceAndFee(
            cityTokenCounts[cityId],
            amount
        );
        require(msg.value >= price + protocolFee + cityFee + holderFee, "Insufficient payment");
        for (uint256 i = 0; i < amount; i++) {
            mintNFT(msg.sender, cityId);
        }
        (bool success1, ) = protocolFeeDestination.call{
            value: protocolFee - ((protocolFee * referralFeePercent) / 1 ether)
        }("");
        (bool success2, ) = cityNFT.ownerOf(cityId).call{value: cityFee}("");
        (bool success3, ) = holderAndReferralFeeDestination.call{
            value: holderFee + ((protocolFee * referralFeePercent) / 1 ether)
        }("");
        require(success1 && success2 && success3, "Unable to send funds");
    }

    function bulkBurnNFT(uint256[] memory tokenIds, uint256 cityId) public {
        uint256 amount = tokenIds.length;
        (uint256 price, uint256 protocolFee, uint256 cityFee, uint256 holderFee) = getPriceAndFee(
            cityTokenCounts[cityId],
            amount
        );
        for (uint256 i = 0; i < amount; i++) {
            burnNFT(tokenIds[i]);
        }
        (bool success1, ) = msg.sender.call{value: price - protocolFee - cityFee - holderFee}("");
        (bool success2, ) = protocolFeeDestination.call{value: protocolFee}("");
        (bool success3, ) = cityNFT.ownerOf(cityId).call{value: cityFee}("");
        (bool success4, ) = holderAndReferralFeeDestination.call{value: holderFee}("");

        require(success1 && success2 && success3 && success4, "Unable to send funds");
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721) {
        super._afterTokenTransfer(from, to, tokenId);
        uint256 cityId = passCity[tokenId];
        if (from != address(0)) {
            cityTokenCounts[cityId]--;
            passBalance[cityId][from]--;
        }
        if (to != address(0)) {
            cityTokenCounts[cityId]++;
            passBalance[tokenId][msg.sender]++;
        }
    }
}
