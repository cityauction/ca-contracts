import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { CityNFT, CityPassNFT } from "../../typechain";
import { e18, expandDecimals, getEthBalance, getLatestBlockTime } from "../helpers";
import { BigNumber } from "ethers";
describe("CityNFT", () => {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let royaltyReceiver: SignerWithAddress;
  let citynft: CityNFT;
  let cityPassNFT: CityPassNFT;
  beforeEach(async () => {
    [owner, user1, user2, royaltyReceiver] = await ethers.getSigners();
    citynft = await (
      await ethers.getContractFactory("CityNFT")
    ).deploy(royaltyReceiver.address, 500);
    cityPassNFT = await (await ethers.getContractFactory("CityPassNFT")).deploy(citynft.address);

    await citynft.createAuction(1, e18(1), "London");
    await ethers.provider.send("evm_increaseTime", [1]);
    await ethers.provider.send("evm_mine", []);
    await citynft.placeBid(1, { value: e18(2) });
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24]);
    await ethers.provider.send("evm_mine", []);
    await citynft.endAuction(1);
  });

  it("simpleTest", async () => {
    await cityPassNFT.bulkMintNFT(1, 1);
    expect(await cityPassNFT.tokenNum()).eq(1);
    expect(await cityPassNFT.passCity(1)).eq(1);
    expect(await cityPassNFT.cityTokenCounts(1)).eq(1);
  });
});
