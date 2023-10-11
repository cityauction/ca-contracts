pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract CityPassNFT is ERC721, Ownable {
    IERC721 public cityNFT; // cityNFT合约

    uint256 public tokenNum = 0; // 自增tokenId

    mapping(uint256 => uint256) public passCity; // 映射：tokenId => cityId
    mapping(uint256 => uint256) public cityTokenCounts; // 存储每个分类下的 NFT 数量
    mapping(uint256 => mapping(address => uint256)) public passBalance;

    constructor(address _cityNFT) ERC721("CityPassNFT", "CityPassNFT") {
        cityNFT = IERC721(_cityNFT);
    }



    function mintNFT(address to, uint256 cityId) internal {
        require(cityNFT.ownerOf(cityId)!=address(0), "Token ID does not exist");
        tokenNum += 1;
        passCity[tokenNum] = cityId; // 将 NFT 与分类关联
        _mint(to, tokenNum);  
    }

    function burnNFT(uint256 tokenId) internal {
        require(_isApprovedOrOwner(msg.sender, tokenId), "You don't own this NFT");
        uint256 cityId = passCity[tokenId]; // 获取 NFT 的分类
        require(cityTokenCounts[cityId] > 0, "Invalid cityId ID");
        _burn(tokenId); // 销毁 NFT
    }

    function bulkMintNFT(uint256 cityId, uint256 amount) public payable {

        for (uint256 i = 0; i < amount; i++) {
            mintNFT(msg.sender, cityId);
        }
    }

    function bulkBurnNFT(uint256[] memory tokenIds) public {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            burnNFT(tokenIds[i]);
        }
    }

    function _afterTokenTransfer(address from, address to, uint256 tokenId) internal virtual override(ERC721) {
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
