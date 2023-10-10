import { FactoryOptions, HardhatRuntimeEnvironment } from "hardhat/types";
import * as zk from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import child_process from "child_process";
import { ethers as ethersSpace } from "ethers";
import fetch from "node-fetch";
import { ZkSyncArtifact } from "@matterlabs/hardhat-zksync-deploy/src/types";

const verifyContract = async (
  artifact: ZkSyncArtifact,
  contract: zk.Contract,
  constructorArgs: any[]
) => {
  try {
    const contractName = artifact.contractName;
    const sourceName = artifact.sourceName;
    const targetFile = sourceName.replace("contracts", "artifacts");
    const cmdTemplate = `npx hardhat flatten ./${sourceName} > ${targetFile}`;
    if (!fs.existsSync(path.dirname(targetFile))) {
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    }
    child_process.execSync(cmdTemplate);
    let sourceCode = fs.readFileSync(targetFile).toString("utf-8");
    sourceCode = sourceCode.replace(/\/\/\s+SPDX-License-Identifier.*\n/gi, "");
    sourceCode = "//SPDX-License-Identifier: MIT\n" + sourceCode;
    const request_body = {
      contractAddress: contract.address,
      contractName,
      optimizationUsed: true,
      zksolcVersion: "v1.3.5",
      solcVersion: "0.8.17",
      sourceCode,
      constructorArguments: contract.interface.encodeDeploy(constructorArgs),
      compilerZksolcVersion: "v1.3.5",
      compilerSolcVersion: "0.8.17",
    };
    console.log("args:", contract.interface.encodeDeploy(constructorArgs));
    const url = "https://zksync2-testnet-explorer.zksync.dev/contract_verification";
    const resp = await fetch(url, {
      method: "post",
      body: JSON.stringify(request_body),
      headers: {
        authority: "zksync2-testnet-explorer.zksync.dev",
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "content-type": "application/json",
        origin: "https://explorer.zksync.io",
        pragma: "no-cache",
        referer: "https://explorer.zksync.io/",
        "sec-ch-ua": '"Chromium";v="106", "Google Chrome";v="106", "Not;A=Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
      },
    });
    const line = `${new Date().toISOString()} ${contractName} ${
      contract.address
    } https://zksync2-testnet-explorer.zksync.dev/contract_verification/${await resp.text()}\n`;
    fs.appendFileSync("verify_contract.log", line);
  } catch (e) {
    console.log("verifyContract error:", e);
  }
};
const verifyContractEra = async (
  artifact: ZkSyncArtifact,
  contract: zk.Contract,
  constructorArgs: any[]
) => {
  try {
    const contractName = artifact.contractName;
    const sourceName = artifact.sourceName;
    const targetFile = sourceName.replace("contracts", "artifacts");
    const cmdTemplate = `npx hardhat flatten ./${sourceName} > ${targetFile}`;
    if (!fs.existsSync(path.dirname(targetFile))) {
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    }
    child_process.execSync(cmdTemplate);
    let sourceCode = fs.readFileSync(targetFile).toString("utf-8");
    sourceCode = sourceCode.replace(/\/\/\s+SPDX-License-Identifier.*\n/gi, "");
    sourceCode = "//SPDX-License-Identifier: MIT\n" + sourceCode;
    const request_body = {
      contractAddress: contract.address,
      contractName,
      optimizationUsed: true,
      zksolcVersion: "v1.3.5",
      solcVersion: "0.8.17",
      sourceCode,
      constructorArguments: contract.interface.encodeDeploy(constructorArgs),
      compilerZksolcVersion: "v1.3.5",
      compilerSolcVersion: "0.8.17",
    };
    console.log("args:", contract.interface.encodeDeploy(constructorArgs));
    const url = "https://zksync2-mainnet-explorer.zksync.io/contract_verification";
    const resp = await fetch(url, {
      method: "post",
      body: JSON.stringify(request_body),
      headers: {
        authority: "zksync2-mainnet-explorer.zksync.io",
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "content-type": "application/json",
        origin: "https://explorer.zksync.io",
        pragma: "no-cache",
        referer: "https://explorer.zksync.io/",
        "sec-ch-ua": '"Chromium";v="106", "Google Chrome";v="106", "Not;A=Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
      },
    });
    const line = `${new Date().toISOString()} ${contractName} ${
      contract.address
    } https://zksync2-mainnet-explorer.zksync.io/contract_verification/${await resp.text()}\n`;
    fs.appendFileSync("verify_contract.log", line);
  } catch (e) {
    console.log("verifyContract error:", e);
  }
};

export const deployContract = async (name: string, constructorArgs: any[], zkOptions?: any) => {
  const network = hre.network as any;
  if (network.name === "zk" || network.name === "era") {
    const wallet = new zk.Wallet(network.config.accounts[0], new zk.Provider(network.config.url));
    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact(name);
    if (zkOptions) {
      const contract = await deployer.deploy(artifact, constructorArgs);
      await verifyContract(artifact, contract, constructorArgs);
      return contract;
    } else {
      const contract = await deployer.deploy(artifact, constructorArgs, zkOptions);
      await verifyContract(artifact, contract, constructorArgs);
      return contract;
    }
  } else {
    const [deployer] = await ethers.getSigners();
    const Contract = await ethers.getContractFactory(name, deployer);
    const contract = await Contract.deploy(...constructorArgs);
    return contract;
  }
};

export const verifyZksyncContract = async (
  address: string,
  name: string,
  constructorArgs: any[],
  zkOptions?: any
) => {
  const network = hre.network as any;
  const wallet = new zk.Wallet(network.config.accounts[0], new zk.Provider(network.config.url));
  const deployer = new Deployer(hre, wallet);
  const artifact = await deployer.loadArtifact(name);
  if (network.name === "zk") {
    if (zkOptions) {
      const contract = (await ethers.getContractFactory(name, wallet)).attach(address);
      await verifyContract(artifact, contract, constructorArgs);
      return contract;
    } else {
      const contract = (await ethers.getContractFactory(name, wallet)).attach(address);
      await verifyContract(artifact, contract, constructorArgs);
      return contract;
    }
  } else if (network.name === "era") {
    if (zkOptions) {
      const contract = (await ethers.getContractFactory(name, wallet)).attach(address);
      await verifyContractEra(artifact, contract, constructorArgs);
      return contract;
    } else {
      const contract = (await ethers.getContractFactory(name, wallet)).attach(address);
      await verifyContractEra(artifact, contract, constructorArgs);
      return contract;
    }
  } else {
    console.log("network support");
  }
};

// networkName: hre.network.name
export const setDeployedAddress = (contractName: string, address: string) => {
  console.log(`setDeployedAddress ${contractName}: ${address}`);
  const jsonFileName = path.resolve(__dirname, `../../deploy/deploy.${hre.network.name}.json`);
  const fileContent = fs.readFileSync(jsonFileName, "utf8");
  let json: any = {};
  try {
    json = { ...JSON.parse(fileContent) };
  } catch (_) {}
  json[contractName] = address;
  fs.writeFileSync(jsonFileName, JSON.stringify(json, null, "  "));
};

export const getDeployedAddress = (contractName: string) => {
  const jsonFileName = path.resolve(__dirname, `../../deploy/deploy.${hre.network.name}.json`);
  const fileContent = fs.readFileSync(jsonFileName, "utf8");
  try {
    return JSON.parse(fileContent)[contractName] || "";
  } catch (_) {
    return "";
  }
};

export const getPythPriceIdKeys = (pythEnv: string) => {
  const jsonFileName = path.resolve(__dirname, `../../deploy/pyth_${pythEnv}.json`);
  const fileContent = fs.readFileSync(jsonFileName, "utf8");
  try {
    return Object.keys(JSON.parse(fileContent));
  } catch (_) {
    return [];
  }
};

export const getPythPriceIdBySymbol = (symbol: string, pythEnv: string) => {
  const jsonFileName = path.resolve(__dirname, `../../deploy/pyth_${pythEnv}.json`);
  const fileContent = fs.readFileSync(jsonFileName, "utf8");
  try {
    return JSON.parse(fileContent)[symbol] || "";
  } catch (_) {
    return "";
  }
};

export const getOTAuctionRecord = () => {
  const jsonFileName = path.resolve(__dirname, `../../deploy/otauction_record.json`);
  const fileContent = fs.readFileSync(jsonFileName, "utf8");
  try {
    return JSON.parse(fileContent) || [];
  } catch (_) {
    return [];
  }
};

export const getWallet = async () => {
  const network = hre.network as any;
  if (network.name === "zk") {
    const wallet = new zk.Wallet(network.config.accounts[0], new zk.Provider(network.config.url));
    return wallet;
  } else {
    const [wallet] = await ethers.getSigners();
    return wallet;
  }
};

export const getDeployer = async () => {
  const network = hre.network as any;
  if (network.name === "zk") {
    const wallet = new zk.Wallet(network.config.accounts[0], new zk.Provider(network.config.url));
    const deployer = new Deployer(hre, wallet);
    return deployer;
  } else {
    const [deployer] = await ethers.getSigners();
    return deployer;
  }
};

export const getDeployedContract = async (contractName: string, deployedAddress: string) => {
  const wallet = await getWallet();
  const contract = (await ethers.getContractFactory(contractName, wallet)).attach(deployedAddress);
  return contract;
};
