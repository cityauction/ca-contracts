import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { CityMarket, CityNFT } from "../../typechain";
import { e18, expandDecimals, getEthBalance, getLatestBlockTime } from "../helpers";
import { BigNumber } from "ethers";
describe("CityMarket", () => {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let royaltyReceiver: SignerWithAddress;
  let citynft: CityNFT;
  let cityMarket: CityMarket;
  beforeEach(async () => {
    [owner, user1, user2, royaltyReceiver] = await ethers.getSigners();
    citynft = await (
      await ethers.getContractFactory("CityNFT")
    ).deploy(royaltyReceiver.address, 500);
    cityMarket = await (await ethers.getContractFactory("CityMarket")).deploy(citynft.address);
    citynft.setCityMarket(cityMarket.address);
  });

  async function createCity(tokenId: number, name: string, user: SignerWithAddress) {
    await citynft.createAuction(tokenId, e18(1), "Hongkong");
    await citynft.connect(user).placeBid(tokenId, { value: e18(2) });
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 25]);
    await ethers.provider.send("evm_mine", []);
    await citynft.endAuction(tokenId);
  }

  it("offerCityForSale", async () => {
    const tokenId = 1;
    await createCity(tokenId, "Hangzhou", user1);
    await expect(cityMarket.offerCityForSale(tokenId, e18(1))).revertedWith(
      "You can only offer a city you own for sale"
    );
    await expect(cityMarket.offerCityForSale(2, e18(1))).revertedWith(
      "ERC721: owner query for nonexistent token"
    );

    await expect(cityMarket.connect(user1).offerCityForSale(tokenId, e18(1))).revertedWith(
      "Not Approved"
    );
    await citynft.connect(user1).approve(cityMarket.address, tokenId);
    await expect(cityMarket.connect(user1).offerCityForSale(tokenId, e18(0))).revertedWith(
      "The min sale price is zero"
    );

    await cityMarket.connect(user1).offerCityForSale(tokenId, e18(1));
    let order = await cityMarket.citiesOfferedForSale(tokenId);
    expect(order.minValue).eq(e18(1));
    expect(order.seller).eq(user1.address);
    await cityMarket.connect(user1).offerCityForSale(tokenId, e18(2));
    order = await cityMarket.citiesOfferedForSale(tokenId);
    expect(order.minValue).eq(e18(2));
    await cityMarket.buyCity(tokenId, { value: e18(2) });
  });

  it("cancel offer city", async () => {
    const tokenId = 1;
    await createCity(tokenId, "Hangzhou", user1);
    await citynft.connect(user1).approve(cityMarket.address, tokenId);
    await cityMarket.connect(user1).offerCityForSale(tokenId, e18(1));
    let order = await cityMarket.citiesOfferedForSale(tokenId);
    expect(order.minValue).eq(e18(1));
    expect(order.seller).eq(user1.address);
    await cityMarket.connect(user1).cityNoLongerForSale(tokenId);
    order = await cityMarket.citiesOfferedForSale(tokenId);
    expect(order.isForSale).eq(false);
    expect(order.minValue).eq(0);
    expect(order.seller).eq(user1.address);
  });

  it("checkTransfer", async () => {
    const tokenId = 1;
    await createCity(tokenId, "Hangzhou", user1);
    await citynft.connect(user1).approve(cityMarket.address, tokenId);
    await cityMarket.connect(user1).offerCityForSale(tokenId, e18(1));
    let order = await cityMarket.citiesOfferedForSale(tokenId);
    expect(order.minValue).eq(e18(1));
    expect(order.isForSale).eq(true);
    expect(order.seller).eq(user1.address);
    await citynft.connect(user1).transferFrom(user1.address, user2.address, tokenId);
    order = await cityMarket.citiesOfferedForSale(tokenId);
    expect(order.isForSale).eq(false);
    expect(order.seller).eq(user2.address);
    expect(order.minValue).eq(0);
  });
});
