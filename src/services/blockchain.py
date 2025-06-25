"""
CultureBridge Backend Blockchain Service
区块链服务，处理代币交易和智能合约交互
"""

import json
import asyncio
from typing import Optional, Dict, Any, List, Tuple
from decimal import Decimal
from web3 import Web3
from web3.middleware import geth_poa_middleware
from eth_account import Account
import requests

from src.config import config
from src.models import db, User, PointTransaction, TransactionType

class BlockchainError(Exception):
    """区块链错误"""
    pass

class BlockchainService:
    """区块链服务类"""
    
    def __init__(self):
        if not config.ENABLE_BLOCKCHAIN:
            return
        
        # 初始化Web3连接
        self.w3 = Web3(Web3.HTTPProvider(config.blockchain.ETH_RPC_URL))
        
        # 添加POA中间件（用于测试网络）
        if config.blockchain.CHAIN_ID != 1:  # 非主网
            self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        # 验证连接
        if not self.w3.is_connected():
            raise BlockchainError("Failed to connect to Ethereum network")
        
        # 智能合约ABI（简化版本）
        self.culture_token_abi = [
            {
                "inputs": [{"name": "_to", "type": "address"}, {"name": "_value", "type": "uint256"}],
                "name": "transfer",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function"
            },
            {
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "balance", "type": "uint256"}],
                "type": "function"
            },
            {
                "inputs": [],
                "name": "totalSupply",
                "outputs": [{"name": "", "type": "uint256"}],
                "type": "function"
            },
            {
                "inputs": [],
                "name": "name",
                "outputs": [{"name": "", "type": "string"}],
                "type": "function"
            },
            {
                "inputs": [],
                "name": "symbol",
                "outputs": [{"name": "", "type": "string"}],
                "type": "function"
            },
            {
                "inputs": [],
                "name": "decimals",
                "outputs": [{"name": "", "type": "uint8"}],
                "type": "function"
            }
        ]
        
        # 学习奖励合约ABI
        self.learning_rewards_abi = [
            {
                "inputs": [{"name": "_user", "type": "address"}, {"name": "_amount", "type": "uint256"}],
                "name": "rewardUser",
                "outputs": [],
                "type": "function"
            },
            {
                "inputs": [{"name": "_user", "type": "address"}],
                "name": "getUserRewards",
                "outputs": [{"name": "", "type": "uint256"}],
                "type": "function"
            }
        ]
        
        # 初始化合约实例
        if config.blockchain.CULTURE_TOKEN_CONTRACT:
            self.culture_token_contract = self.w3.eth.contract(
                address=config.blockchain.CULTURE_TOKEN_CONTRACT,
                abi=self.culture_token_abi
            )
        
        if config.blockchain.LEARNING_REWARDS_CONTRACT:
            self.learning_rewards_contract = self.w3.eth.contract(
                address=config.blockchain.LEARNING_REWARDS_CONTRACT,
                abi=self.learning_rewards_abi
            )
    
    def is_enabled(self) -> bool:
        """检查区块链功能是否启用"""
        return config.ENABLE_BLOCKCHAIN
    
    async def create_wallet(self) -> Tuple[str, str]:
        """创建新钱包"""
        if not self.is_enabled():
            raise BlockchainError("Blockchain functionality is disabled")
        
        # 生成新账户
        account = Account.create()
        
        return account.address, account.privateKey.hex()
    
    async def get_balance(self, wallet_address: str) -> Dict[str, Any]:
        """获取钱包余额"""
        if not self.is_enabled():
            raise BlockchainError("Blockchain functionality is disabled")
        
        try:
            # 获取ETH余额
            eth_balance_wei = self.w3.eth.get_balance(wallet_address)
            eth_balance = self.w3.from_wei(eth_balance_wei, 'ether')
            
            # 获取代币余额
            token_balance = 0
            if hasattr(self, 'culture_token_contract'):
                token_balance_wei = self.culture_token_contract.functions.balanceOf(wallet_address).call()
                token_decimals = self.culture_token_contract.functions.decimals().call()
                token_balance = token_balance_wei / (10 ** token_decimals)
            
            return {
                'wallet_address': wallet_address,
                'eth_balance': float(eth_balance),
                'token_balance': float(token_balance),
                'total_value_usd': await self._calculate_total_value_usd(eth_balance, token_balance)
            }
            
        except Exception as e:
            raise BlockchainError(f"Failed to get balance: {str(e)}")
    
    async def transfer_tokens(
        self,
        from_address: str,
        private_key: str,
        to_address: str,
        amount: float,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """转账代币"""
        if not self.is_enabled():
            raise BlockchainError("Blockchain functionality is disabled")
        
        if not hasattr(self, 'culture_token_contract'):
            raise BlockchainError("Culture token contract not configured")
        
        try:
            # 获取代币精度
            decimals = self.culture_token_contract.functions.decimals().call()
            amount_wei = int(amount * (10 ** decimals))
            
            # 构建交易
            nonce = self.w3.eth.get_transaction_count(from_address)
            
            transaction = self.culture_token_contract.functions.transfer(
                to_address,
                amount_wei
            ).build_transaction({
                'chainId': config.blockchain.CHAIN_ID,
                'gas': config.blockchain.GAS_LIMIT,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': nonce,
            })
            
            # 签名交易
            signed_txn = self.w3.eth.account.sign_transaction(transaction, private_key)
            
            # 发送交易
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # 等待交易确认
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            # 记录交易
            if user_id:
                transaction_record = PointTransaction(
                    user_id=user_id,
                    amount=-int(amount),  # 负数表示转出
                    transaction_type=TransactionType.TRANSFER,
                    description=f"Transfer {amount} tokens to {to_address}",
                    related_id=receipt.transactionHash.hex(),
                    related_type='blockchain_transfer'
                )
                db.session.add(transaction_record)
                db.session.commit()
            
            return {
                'transaction_hash': receipt.transactionHash.hex(),
                'from_address': from_address,
                'to_address': to_address,
                'amount': amount,
                'gas_used': receipt.gasUsed,
                'status': 'success' if receipt.status == 1 else 'failed'
            }
            
        except Exception as e:
            raise BlockchainError(f"Token transfer failed: {str(e)}")
    
    async def reward_user(
        self,
        user_address: str,
        amount: float,
        reason: str = "Learning reward",
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """奖励用户代币"""
        if not self.is_enabled():
            raise BlockchainError("Blockchain functionality is disabled")
        
        if not hasattr(self, 'learning_rewards_contract'):
            raise BlockchainError("Learning rewards contract not configured")
        
        try:
            # 这里需要管理员私钥来执行奖励
            admin_private_key = config.blockchain.ETH_PRIVATE_KEY
            if not admin_private_key:
                raise BlockchainError("Admin private key not configured")
            
            admin_account = Account.from_key(admin_private_key)
            
            # 获取代币精度
            decimals = self.culture_token_contract.functions.decimals().call()
            amount_wei = int(amount * (10 ** decimals))
            
            # 构建交易
            nonce = self.w3.eth.get_transaction_count(admin_account.address)
            
            transaction = self.learning_rewards_contract.functions.rewardUser(
                user_address,
                amount_wei
            ).build_transaction({
                'chainId': config.blockchain.CHAIN_ID,
                'gas': config.blockchain.GAS_LIMIT,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': nonce,
            })
            
            # 签名交易
            signed_txn = self.w3.eth.account.sign_transaction(transaction, admin_private_key)
            
            # 发送交易
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # 等待交易确认
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            # 记录交易
            if user_id:
                transaction_record = PointTransaction(
                    user_id=user_id,
                    amount=int(amount),
                    transaction_type=TransactionType.REWARD,
                    description=reason,
                    related_id=receipt.transactionHash.hex(),
                    related_type='blockchain_reward'
                )
                db.session.add(transaction_record)
                db.session.commit()
            
            return {
                'transaction_hash': receipt.transactionHash.hex(),
                'user_address': user_address,
                'amount': amount,
                'reason': reason,
                'gas_used': receipt.gasUsed,
                'status': 'success' if receipt.status == 1 else 'failed'
            }
            
        except Exception as e:
            raise BlockchainError(f"User reward failed: {str(e)}")
    
    async def get_transaction_history(
        self,
        wallet_address: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """获取交易历史"""
        if not self.is_enabled():
            raise BlockchainError("Blockchain functionality is disabled")
        
        try:
            # 获取最新区块号
            latest_block = self.w3.eth.block_number
            
            # 查询最近的交易（简化实现）
            transactions = []
            
            # 这里应该使用事件日志来获取代币转账记录
            # 由于需要更复杂的实现，这里提供一个基础框架
            
            return transactions
            
        except Exception as e:
            raise BlockchainError(f"Failed to get transaction history: {str(e)}")
    
    async def get_token_info(self) -> Dict[str, Any]:
        """获取代币信息"""
        if not self.is_enabled():
            raise BlockchainError("Blockchain functionality is disabled")
        
        if not hasattr(self, 'culture_token_contract'):
            raise BlockchainError("Culture token contract not configured")
        
        try:
            name = self.culture_token_contract.functions.name().call()
            symbol = self.culture_token_contract.functions.symbol().call()
            decimals = self.culture_token_contract.functions.decimals().call()
            total_supply_wei = self.culture_token_contract.functions.totalSupply().call()
            total_supply = total_supply_wei / (10 ** decimals)
            
            return {
                'name': name,
                'symbol': symbol,
                'decimals': decimals,
                'total_supply': float(total_supply),
                'contract_address': config.blockchain.CULTURE_TOKEN_CONTRACT
            }
            
        except Exception as e:
            raise BlockchainError(f"Failed to get token info: {str(e)}")
    
    async def estimate_gas_fee(
        self,
        from_address: str,
        to_address: str,
        amount: float
    ) -> Dict[str, Any]:
        """估算Gas费用"""
        if not self.is_enabled():
            raise BlockchainError("Blockchain functionality is disabled")
        
        try:
            # 获取当前Gas价格
            gas_price = self.w3.eth.gas_price
            
            # 估算Gas使用量
            if hasattr(self, 'culture_token_contract'):
                decimals = self.culture_token_contract.functions.decimals().call()
                amount_wei = int(amount * (10 ** decimals))
                
                gas_estimate = self.culture_token_contract.functions.transfer(
                    to_address,
                    amount_wei
                ).estimate_gas({'from': from_address})
            else:
                # ETH转账的Gas估算
                gas_estimate = 21000
            
            # 计算费用
            gas_fee_wei = gas_estimate * gas_price
            gas_fee_eth = self.w3.from_wei(gas_fee_wei, 'ether')
            
            return {
                'gas_estimate': gas_estimate,
                'gas_price_gwei': self.w3.from_wei(gas_price, 'gwei'),
                'gas_fee_eth': float(gas_fee_eth),
                'gas_fee_usd': await self._eth_to_usd(float(gas_fee_eth))
            }
            
        except Exception as e:
            raise BlockchainError(f"Failed to estimate gas fee: {str(e)}")
    
    async def verify_transaction(self, tx_hash: str) -> Dict[str, Any]:
        """验证交易"""
        if not self.is_enabled():
            raise BlockchainError("Blockchain functionality is disabled")
        
        try:
            # 获取交易收据
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            transaction = self.w3.eth.get_transaction(tx_hash)
            
            return {
                'transaction_hash': tx_hash,
                'status': 'success' if receipt.status == 1 else 'failed',
                'block_number': receipt.blockNumber,
                'from_address': transaction['from'],
                'to_address': transaction['to'],
                'value': float(self.w3.from_wei(transaction['value'], 'ether')),
                'gas_used': receipt.gasUsed,
                'gas_price': float(self.w3.from_wei(transaction['gasPrice'], 'gwei')),
                'confirmations': self.w3.eth.block_number - receipt.blockNumber
            }
            
        except Exception as e:
            raise BlockchainError(f"Failed to verify transaction: {str(e)}")
    
    async def _calculate_total_value_usd(self, eth_balance: float, token_balance: float) -> float:
        """计算总价值（美元）"""
        try:
            eth_price_usd = await self._get_eth_price_usd()
            token_price_usd = await self._get_token_price_usd()
            
            total_value = (eth_balance * eth_price_usd) + (token_balance * token_price_usd)
            return total_value
            
        except Exception:
            return 0.0
    
    async def _get_eth_price_usd(self) -> float:
        """获取ETH价格（美元）"""
        try:
            response = requests.get(
                'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
                timeout=10
            )
            data = response.json()
            return data['ethereum']['usd']
        except Exception:
            return 0.0
    
    async def _get_token_price_usd(self) -> float:
        """获取代币价格（美元）"""
        # 这里应该实现获取自定义代币价格的逻辑
        # 可以通过DEX API或者预言机获取
        return 0.1  # 假设价格
    
    async def _eth_to_usd(self, eth_amount: float) -> float:
        """ETH转美元"""
        eth_price = await self._get_eth_price_usd()
        return eth_amount * eth_price

# 全局区块链服务实例
blockchain_service = BlockchainService() if config.ENABLE_BLOCKCHAIN else None

# 导出
__all__ = ['BlockchainService', 'blockchain_service', 'BlockchainError']

