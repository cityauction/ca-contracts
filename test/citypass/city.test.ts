import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { CityNFT } from "../../typechain";
import { e18, expandDecimals, getLatestBlockTime } from "../helpers";
import { BigNumber } from "ethers";
describe("CityNFT", () => {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let citynft: CityNFT;
  let ftRouter: FTRoutr;
  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    citynft = await (await ethers.getContractFactory("CityNFT")).deploy(user2.address, 500);
  });

  it("AuctionStatus", async function () {
    await citynft.createAuction(1, e18(1));
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
    console.log(auction);
  });
});
