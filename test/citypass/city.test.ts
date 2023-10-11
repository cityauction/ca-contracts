import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { CityNFT } from "../../typechain";
import { e18, expandDecimals, getEthBalance, getLatestBlockTime } from "../helpers";
import { BigNumber } from "ethers";
describe("CityNFT", () => {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let royaltyReceiver: SignerWithAddress;
  let citynft: CityNFT;
  beforeEach(async () => {
    [owner, user1, user2, royaltyReceiver] = await ethers.getSigners();
    citynft = await (
      await ethers.getContractFactory("CityNFT")
    ).deploy(royaltyReceiver.address, 500);
  });

  it("AuctionStatus", async function () {
    await citynft.createAuction(1, e18(1), "Hongkong");
    let auction = await citynft.auctions(1);

    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    let status = await citynft.getAuctionStatus(auction.tokenId);
    expect(status).eq(1);
    await citynft.connect(user1).placeBid(auction.tokenId, { value: e18(2) });
    status = await citynft.getAuctionStatus(auction.tokenId);
    expect(status).eq(1);
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24]);
    await ethers.provider.send("evm_mine", []);
    status = await citynft.getAuctionStatus(auction.tokenId);
    expect(status).eq(2);
    await citynft.endAuction(auction.tokenId);
    status = await citynft.getAuctionStatus(auction.tokenId);
    expect(status).eq(0);
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24]);
    await ethers.provider.send("evm_mine", []);
    status = await citynft.getAuctionStatus(auction.tokenId);
    expect(status).eq(0);
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 89 + 1]);
    await ethers.provider.send("evm_mine", []);
    status = await citynft.getAuctionStatus(auction.tokenId);
    expect(status).eq(1);
    // 流拍
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24]);
    await ethers.provider.send("evm_mine", []);
    status = await citynft.getAuctionStatus(auction.tokenId);
    expect(status).eq(1);
    await citynft.connect(user1).placeBid(auction.tokenId, { value: e18(3) });
    status = await citynft.getAuctionStatus(auction.tokenId);
    expect(status).eq(1);
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24]);
    await ethers.provider.send("evm_mine", []);
    status = await citynft.getAuctionStatus(auction.tokenId);
    expect(status).eq(2);
    await citynft.endAuction(auction.tokenId);
    status = await citynft.getAuctionStatus(auction.tokenId);
    expect(status).eq(0);
    auction = await citynft.auctions(1);
  });
  it("should allow create a Auction", async () => {
    await expect(citynft.connect(user1).createAuction(1, e18(1), "Hongkong")).revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(citynft.createAuction(1, 0, "Hongkong")).revertedWith(
      "Reserve price must be greater than zero"
    );
    await citynft.createAuction(1, e18(1), "Hongkong");
    await expect(citynft.createAuction(1, e18(1), "Hongkong2")).revertedWith(
      "Auction already exists for this NFT"
    );
    const auction = await citynft.auctions(1);
    expect(auction.tokenId).eq(1);
    expect(auction.place).eq("Hongkong");
    expect(auction.reservePrice).eq(e18(1));
  });
  it("should allow placeBid", async () => {
    await citynft.createAuction(1, e18(1), "Hongkong");
    expect(await citynft.getAuctionStatus(1)).eq(0);
    // 1 second
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    expect(await citynft.getAuctionStatus(1)).eq(1);

    await expect(citynft.connect(user1).placeBid(2)).revertedWith(
      "Auction not exists for this NFT"
    );

    await expect(citynft.connect(user1).placeBid(1)).revertedWith(
      "Bid must be greater than reserve price"
    );
    await citynft.connect(user1).placeBid(1, { value: e18(2) });
    const auction = await citynft.auctions(1);
    expect(auction.topBidder).eq(user1.address);
    expect(auction.topBid).eq(e18(2));
    expect(auction.latestBidTime).gt(0);
    expect(await getEthBalance(citynft.address)).eq(e18(2));
    await expect(citynft.connect(user2).placeBid(1, { value: e18(2) })).revertedWith(
      "Bid must be greater than topBid price"
    );
    const user1Balance = await getEthBalance(user1.address);
    await citynft.connect(user2).placeBid(1, { value: e18(3) });
    expect(await getEthBalance(citynft.address)).eq(e18(3));
    const user1Balance2 = await getEthBalance(user1.address);
    expect(user1Balance2.sub(user1Balance)).eq(e18(2));
    const auction2 = await citynft.auctions(1);
    expect(auction2.topBidder).eq(user2.address);
    expect(auction2.topBid).eq(e18(3));
    expect(auction2.latestBidTime).gt(auction.latestBidTime);
    //
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 - 10]);
    await ethers.provider.send("evm_mine", []);
    expect(await citynft.getAuctionStatus(1)).eq(1);
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    expect(await citynft.getAuctionStatus(1)).eq(2);
    await expect(citynft.connect(user1).placeBid(1, { value: e18(2) })).revertedWith(
      "Auction has ended"
    );

    await citynft.endAuction(1);
    expect(await citynft.getAuctionStatus(1)).eq(0);
    await expect(citynft.connect(user1).placeBid(1, { value: e18(2) })).revertedWith(
      "Auction has not started yet"
    );
  });

  it("endAuction", async () => {
    // await citynft.createAuction(1, e18(1), "Hongkong");
    // await citynft.createAuction(2, e18(1), "London");
    await expect(citynft.connect(user1).endAuction(1)).revertedWith(
      "Auction not exists for this NFT"
    );
    await citynft.createAuction(1, e18(1), "Hongkong");
    await expect(citynft.connect(user1).endAuction(1)).revertedWith("Auction has not ended");
    expect(await citynft.getAuctionStatus(1)).eq(1);
    await citynft.connect(user2).placeBid(1, { value: e18(2) });
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24]);
    await ethers.provider.send("evm_mine", []);
    expect(await citynft.getAuctionStatus(1)).eq(2);
    const royaltyReceiverBal = await getEthBalance(royaltyReceiver.address);
    await citynft.connect(user1).endAuction(1);
    const royaltyReceiverBal2 = await getEthBalance(royaltyReceiver.address);
    // first mint mintFee
    expect(royaltyReceiverBal2.sub(royaltyReceiverBal)).eq(e18(2));
    const auction = await citynft.auctions(1);
    expect(auction.topBid).eq(0);
    expect(auction.latestBidTime).eq(0);
    // 2/0.95~=2.105
    expect(auction.reservePrice).gt(e18(21).div(10));
    expect(auction.reservePrice).lt(e18(211).div(100));
    // pending
    expect(await citynft.getAuctionStatus(1)).eq(0);
    await expect(citynft.connect(user1).endAuction(1)).revertedWith("Auction has not ended");
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 90]);
    await ethers.provider.send("evm_mine", []);
    expect(await citynft.getAuctionStatus(1)).eq(1);

    // second  auction

    await citynft.connect(user1).placeBid(1, { value: e18(3) });
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24]);
    await ethers.provider.send("evm_mine", []);
    expect(await citynft.getAuctionStatus(1)).eq(2);
    const nftowner = await citynft.ownerOf(1);
    expect(nftowner).eq(user2.address);
    const nftOwnerBal = await getEthBalance(nftowner);
    const _royaltyReceiverBal = await getEthBalance(royaltyReceiver.address);
    await citynft.endAuction(1);
    expect(await citynft.ownerOf(1)).eq(user1.address);
    // 3*0.95 =2.85
    expect((await getEthBalance(nftowner)).sub(nftOwnerBal)).eq(e18(285).div(100));
    // royalty
    expect((await getEthBalance(royaltyReceiver.address)).sub(_royaltyReceiverBal)).eq(
      e18(15).div(100)
    );
  });
});
