import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-contract-sizer";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        // runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    goerli: {
      url: process.env.GOERLI_URL || "",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      zksync: false,
      gasMultiplier: 5,
    },
    sepolia: {
      url: process.env.SEPOLIA_URL || "",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      zksync: false,
    },
    arbitrum: {
      url: process.env.ARBITRUM_URL || "",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      zksync: false,
    },
    zk: {
      url: "https://zksync2-testnet.zksync.dev",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      ethNetwork: "goerli",
      zksync: true,
    },
    era: {
      url: "https://mainnet.era.zksync.io",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      ethNetwork: "mainnet",
      zksync: true,
    },
    "base-mainnet": {
      url: "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 1000000000,
    },
    // for testnet
    "base-goerli": {
      url: "https://goerli.base.org",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 1000000000,
    },
    // for local dev environment
    "base-local": {
      url: "http://localhost:8545",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 1000000000,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  contractSizer: {
    runOnCompile: process.env.REPORT_SIZE !== undefined,
  },

  zksolc: {
    version: "1.3.5",
    compilerSource: "binary",
    settings: {},
  },
};

export default config;
