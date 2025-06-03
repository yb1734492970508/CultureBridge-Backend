/**
 * 区块链配置文件
 * 用于配置区块链相关参数
 */

module.exports = {
  // 区块链网络配置
  network: {
    mainnet: {
      rpcUrl: process.env.BLOCKCHAIN_MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/your-project-id',
      chainId: 1,
      explorer: 'https://etherscan.io'
    },
    testnet: {
      rpcUrl: process.env.BLOCKCHAIN_TESTNET_RPC_URL || 'https://sepolia.infura.io/v3/your-project-id',
      chainId: 11155111,
      explorer: 'https://sepolia.etherscan.io'
    },
    development: {
      rpcUrl: process.env.BLOCKCHAIN_DEV_RPC_URL || 'http://localhost:8545',
      chainId: 1337,
      explorer: ''
    }
  },
  
  // 默认网络环境
  defaultNetwork: process.env.BLOCKCHAIN_NETWORK || 'development',
  
  // 合约地址配置
  contracts: {
    mainnet: {
      tokenContract: process.env.TOKEN_CONTRACT_MAINNET || '',
      governanceContract: process.env.GOVERNANCE_CONTRACT_MAINNET || '',
      stakingContract: process.env.STAKING_CONTRACT_MAINNET || ''
    },
    testnet: {
      tokenContract: process.env.TOKEN_CONTRACT_TESTNET || '',
      governanceContract: process.env.GOVERNANCE_CONTRACT_TESTNET || '',
      stakingContract: process.env.STAKING_CONTRACT_TESTNET || ''
    },
    development: {
      tokenContract: process.env.TOKEN_CONTRACT_DEV || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      governanceContract: process.env.GOVERNANCE_CONTRACT_DEV || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      stakingContract: process.env.STAKING_CONTRACT_DEV || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
    }
  },
  
  // Gas配置
  gas: {
    limit: process.env.GAS_LIMIT || 3000000,
    price: process.env.GAS_PRICE || '5000000000' // 5 Gwei
  },
  
  // 交易确认配置
  transaction: {
    confirmations: process.env.TX_CONFIRMATIONS || 1,
    timeout: process.env.TX_TIMEOUT || 120000 // 2分钟
  },
  
  // 企业级功能配置
  enterprise: {
    // 组织上链配置
    organization: {
      registryContract: process.env.ORGANIZATION_REGISTRY_CONTRACT || '',
      gasLimit: process.env.ORGANIZATION_GAS_LIMIT || 2000000
    },
    
    // 权限上链配置
    permission: {
      registryContract: process.env.PERMISSION_REGISTRY_CONTRACT || '',
      gasLimit: process.env.PERMISSION_GAS_LIMIT || 1500000
    }
  },
  
  // 区块链服务配置
  service: {
    retryAttempts: process.env.BLOCKCHAIN_RETRY_ATTEMPTS || 3,
    retryDelay: process.env.BLOCKCHAIN_RETRY_DELAY || 1000, // 1秒
    eventPollingInterval: process.env.EVENT_POLLING_INTERVAL || 15000 // 15秒
  }
};
