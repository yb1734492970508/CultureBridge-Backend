"""
CultureBridge Backend Blockchain Routes
区块链相关的API路由
"""

from flask import Blueprint, request, jsonify, current_app
import asyncio

from src.services.auth import login_required, get_current_user
from src.services.blockchain import blockchain_service, BlockchainError

# 创建蓝图
blockchain_bp = Blueprint('blockchain', __name__)

@blockchain_bp.route('/wallet/balance', methods=['GET'])
@login_required
def get_wallet_balance():
    """获取钱包余额"""
    
    try:
        current_user = get_current_user()
        
        if not current_user.wallet_address:
            return jsonify({
                'error': 'no_wallet',
                'message': 'User does not have a wallet'
            }), 400
        
        # 获取余额
        balance = asyncio.run(blockchain_service.get_balance(current_user.wallet_address))
        
        return jsonify({
            'balance': balance
        }), 200
        
    except BlockchainError as e:
        return jsonify({
            'error': 'blockchain_error',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Get wallet balance error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get wallet balance'
        }), 500

@blockchain_bp.route('/token/info', methods=['GET'])
def get_token_info():
    """获取代币信息"""
    
    try:
        token_info = asyncio.run(blockchain_service.get_token_info())
        
        return jsonify({
            'token_info': token_info
        }), 200
        
    except BlockchainError as e:
        return jsonify({
            'error': 'blockchain_error',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Get token info error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get token info'
        }), 500

