import { BigNumber, BigNumberish } from "ethers";
import { ethers, network } from "hardhat";
import BN from "bn.js";
import { string } from "hardhat/internal/core/params/argumentTypes";

export function e(num: BigNumberish, exp: BigNumberish) {
  return BigNumber.from(10).pow(exp).mul(num);
}
export function e18(num: BigNumberish) {
  return e(num, 18);
}
export function e8(num: BigNumberish) {
  return e(num, 8);
}
export function e6(num: BigNumberish) {
  return e(num, 6);
}
export function e0(num: BigNumberish) {
  return e(num, 0);
}

export async function getLatestBlockTime() {
  const blockNum = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNum);
  return block.timestamp;
}

export async function getLatestBlockNumber() {
  const blockNum = await ethers.provider.getBlockNumber();
  return blockNum;
}

export async function mineBlock() {
  await network.provider.send("evm_mine");
}

export async function hardhatMine(blockNumber: number, blockInterval: number) {
  await network.provider.send("hardhat_mine", [
    `0x${blockNumber.toString(16)}`,
    `0x${blockInterval.toString(16)}`,
  ]);
}

export async function setNextBlockTimeAndMine(blockTime: number) {
  await network.provider.send("evm_setNextBlockTimestamp", [blockTime]);
  await network.provider.send("hardhat_mine");
}

export async function setNextBlockTime(blockTime: number) {
  await network.provider.send("evm_setNextBlockTimestamp", [blockTime]);
}

function bigNumberify(n: number | bigint | string) {
  return ethers.BigNumber.from(n);
}
export function expandDecimals(n: number, decimals: number) {
  // console.log(n, decimals)
  // return bigNumberify(BigInt(Math.round(n * 10 ** decimals)));
  const value = bigNumberify(n).mul(bigNumberify(10).pow(decimals));
  // console.log('expandDecimals', n, decimals, value.toString())
  return value;
}

export function encodeFuturePrice(usdPrice: number | bigint | string, tokenDecimal: number) {}

export function getPriceBitArray(prices: string[]) {
  const priceBitArray = [];
  let shouldExit = false;

  for (let i = 0; i < Math.floor((prices.length - 1) / 8) + 1; i++) {
    let priceBits = new BN("0");
    for (let j = 0; j < 8; j++) {
      const index = i * 8 + j;
      if (index >= prices.length) {
        shouldExit = true;
        break;
      }

      const price = new BN(prices[index]);
      if (price.gt(new BN("2147483648"))) {
        // 2^31
        throw new Error(`price exceeds bit limit ${price.toString()}`);
      }
      priceBits = priceBits.or(price.shln(j * 32));
    }

    priceBitArray.push(priceBits.toString());

    if (shouldExit) {
      break;
    }
  }

  return priceBitArray;
}

export function getExpandedPrice(price: number | string | bigint, precision: number) {
  return bigNumberify(price).mul(expandDecimals(1, 30)).div(precision);
}

export function getPriceBits(prices: string[]) {
  if (prices.length > 8) {
    throw new Error("max prices.length exceeded");
  }

  let priceBits = new BN("0");

  for (let j = 0; j < 8; j++) {
    const index = j;
    if (index >= prices.length) {
      break;
    }

    const price = new BN(prices[index]);
    if (price.gt(new BN("2147483648"))) {
      // 2^31
      throw new Error(`price exceeds bit limit ${price.toString()}`);
    }

    priceBits = priceBits.or(price.shln(j * 32));
  }

  return priceBits.toString();
}

export async function getEthBalance(addr: string) {
  const bal = await ethers.provider.getBalance(addr);
  return bal;
}

export async function setEthBalance(addr: string, bal: BigNumberish) {
  await network.provider.send("hardhat_setBalance", [addr, bal]);
}

export function exp10(exp: number, base: number = 1) {
  return String(base).padEnd(exp + 1, "0");
}
