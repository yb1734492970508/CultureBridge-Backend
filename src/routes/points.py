"""
CultureBridge Backend Points System Routes
积分系统相关的API路由
"""

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import uuid

# 创建蓝图
points_bp = Blueprint('points', __name__, url_prefix='/api/points')

# 模拟数据库存储
points_data = {
    'users': {},
    'transactions': [],
    'rewards': {
        'daily_login': 10,
        'cultural_post': 50,
        'language_practice': 20,
        'community_interaction': 15,
        'content_share': 25,
        'achievement_unlock': 100
    }
}

def get_user_points(user_id):
    """获取用户积分"""
    if user_id not in points_data['users']:
        points_data['users'][user_id] = {
            'total_points': 230,  # 默认积分
            'available_points': 230,
            'earned_today': 0,
            'last_login': None,
            'level': 'Intermediate',
            'achievements': []
        }
    return points_data['users'][user_id]

def add_transaction(user_id, amount, transaction_type, description):
    """添加交易记录"""
    transaction = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'amount': amount,
        'type': transaction_type,
        'description': description,
        'timestamp': datetime.utcnow().isoformat(),
        'date': datetime.utcnow().strftime('%b %d, %Y')
    }
    points_data['transactions'].append(transaction)
    return transaction

@points_bp.route('/balance', methods=['GET'])
@jwt_required()
def get_points_balance():
    """获取用户积分余额"""
    try:
        user_id = get_jwt_identity()
        user_points = get_user_points(user_id)
        
        return jsonify({
            'success': True,
            'data': {
                'total_points': user_points['total_points'],
                'available_points': user_points['available_points'],
                'earned_today': user_points['earned_today'],
                'level': user_points['level']
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get points balance error: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'internal_error',
            'message': 'Failed to get points balance'
        }), 500

@points_bp.route('/transactions', methods=['GET'])
@jwt_required()
def get_transactions():
    """获取用户交易历史"""
    try:
        user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        
        # 获取用户的交易记录
        user_transactions = [
            t for t in points_data['transactions'] 
            if t['user_id'] == user_id
        ]
        
        # 如果没有交易记录，创建一些示例数据
        if not user_transactions:
            sample_transactions = [
                {
                    'id': str(uuid.uuid4()),
                    'user_id': user_id,
                    'amount': 500,
                    'type': 'received',
                    'description': 'Cultural content reward',
                    'timestamp': (datetime.utcnow() - timedelta(days=3)).isoformat(),
                    'date': (datetime.utcnow() - timedelta(days=3)).strftime('%b %d, %Y')
                },
                {
                    'id': str(uuid.uuid4()),
                    'user_id': user_id,
                    'amount': -700,
                    'type': 'sent',
                    'description': 'Language lesson purchase',
                    'timestamp': (datetime.utcnow() - timedelta(days=3)).isoformat(),
                    'date': (datetime.utcnow() - timedelta(days=3)).strftime('%b %d, %Y')
                },
                {
                    'id': str(uuid.uuid4()),
                    'user_id': user_id,
                    'amount': 1200,
                    'type': 'received',
                    'description': 'Community participation bonus',
                    'timestamp': (datetime.utcnow() - timedelta(days=4)).isoformat(),
                    'date': (datetime.utcnow() - timedelta(days=4)).strftime('%b %d, %Y')
                },
                {
                    'id': str(uuid.uuid4()),
                    'user_id': user_id,
                    'amount': -400,
                    'type': 'sent',
                    'description': 'Cultural exchange fee',
                    'timestamp': (datetime.utcnow() - timedelta(days=4)).isoformat(),
                    'date': (datetime.utcnow() - timedelta(days=4)).strftime('%b %d, %Y')
                }
            ]
            
            points_data['transactions'].extend(sample_transactions)
            user_transactions = sample_transactions
        
        # 按时间排序（最新的在前）
        user_transactions.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # 分页
        start = (page - 1) * limit
        end = start + limit
        paginated_transactions = user_transactions[start:end]
        
        return jsonify({
            'success': True,
            'data': {
                'transactions': paginated_transactions,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total': len(user_transactions),
                    'has_more': end < len(user_transactions)
                }
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get transactions error: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'internal_error',
            'message': 'Failed to get transactions'
        }), 500

@points_bp.route('/earn', methods=['POST'])
@jwt_required()
def earn_points():
    """赚取积分"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        action = data.get('action')
        if not action:
            return jsonify({
                'success': False,
                'error': 'missing_action',
                'message': 'Action is required'
            }), 400
        
        # 检查是否是有效的赚取积分行为
        if action not in points_data['rewards']:
            return jsonify({
                'success': False,
                'error': 'invalid_action',
                'message': 'Invalid action for earning points'
            }), 400
        
        points_earned = points_data['rewards'][action]
        user_points = get_user_points(user_id)
        
        # 更新用户积分
        user_points['total_points'] += points_earned
        user_points['available_points'] += points_earned
        user_points['earned_today'] += points_earned
        
        # 添加交易记录
        transaction = add_transaction(
            user_id, 
            points_earned, 
            'received', 
            f'Earned from {action.replace("_", " ")}'
        )
        
        return jsonify({
            'success': True,
            'data': {
                'points_earned': points_earned,
                'total_points': user_points['total_points'],
                'transaction': transaction
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Earn points error: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'internal_error',
            'message': 'Failed to earn points'
        }), 500

@points_bp.route('/spend', methods=['POST'])
@jwt_required()
def spend_points():
    """消费积分"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        amount = data.get('amount')
        description = data.get('description', 'Points spent')
        
        if not amount or amount <= 0:
            return jsonify({
                'success': False,
                'error': 'invalid_amount',
                'message': 'Valid amount is required'
            }), 400
        
        user_points = get_user_points(user_id)
        
        # 检查余额是否足够
        if user_points['available_points'] < amount:
            return jsonify({
                'success': False,
                'error': 'insufficient_points',
                'message': 'Insufficient points balance'
            }), 400
        
        # 扣除积分
        user_points['available_points'] -= amount
        
        # 添加交易记录
        transaction = add_transaction(
            user_id, 
            -amount, 
            'sent', 
            description
        )
        
        return jsonify({
            'success': True,
            'data': {
                'points_spent': amount,
                'remaining_points': user_points['available_points'],
                'transaction': transaction
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Spend points error: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'internal_error',
            'message': 'Failed to spend points'
        }), 500

@points_bp.route('/transfer', methods=['POST'])
@jwt_required()
def transfer_points():
    """转移积分给其他用户"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        recipient_id = data.get('recipient_id')
        amount = data.get('amount')
        message = data.get('message', '')
        
        if not recipient_id or not amount or amount <= 0:
            return jsonify({
                'success': False,
                'error': 'invalid_data',
                'message': 'Recipient ID and valid amount are required'
            }), 400
        
        if recipient_id == user_id:
            return jsonify({
                'success': False,
                'error': 'self_transfer',
                'message': 'Cannot transfer points to yourself'
            }), 400
        
        sender_points = get_user_points(user_id)
        recipient_points = get_user_points(recipient_id)
        
        # 检查发送者余额
        if sender_points['available_points'] < amount:
            return jsonify({
                'success': False,
                'error': 'insufficient_points',
                'message': 'Insufficient points balance'
            }), 400
        
        # 执行转账
        sender_points['available_points'] -= amount
        recipient_points['total_points'] += amount
        recipient_points['available_points'] += amount
        
        # 添加交易记录
        sender_transaction = add_transaction(
            user_id, 
            -amount, 
            'sent', 
            f'Transfer to user {recipient_id}: {message}'
        )
        
        recipient_transaction = add_transaction(
            recipient_id, 
            amount, 
            'received', 
            f'Transfer from user {user_id}: {message}'
        )
        
        return jsonify({
            'success': True,
            'data': {
                'amount_transferred': amount,
                'remaining_points': sender_points['available_points'],
                'transaction': sender_transaction
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Transfer points error: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'internal_error',
            'message': 'Failed to transfer points'
        }), 500

@points_bp.route('/rewards', methods=['GET'])
def get_rewards_info():
    """获取积分奖励信息"""
    try:
        return jsonify({
            'success': True,
            'data': {
                'rewards': points_data['rewards'],
                'description': {
                    'daily_login': 'Daily login bonus',
                    'cultural_post': 'Share cultural content',
                    'language_practice': 'Complete language practice',
                    'community_interaction': 'Interact with community',
                    'content_share': 'Share content with others',
                    'achievement_unlock': 'Unlock new achievement'
                }
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get rewards info error: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'internal_error',
            'message': 'Failed to get rewards info'
        }), 500

@points_bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    """获取积分排行榜"""
    try:
        # 获取所有用户的积分数据
        leaderboard = []
        for user_id, user_data in points_data['users'].items():
            leaderboard.append({
                'user_id': user_id,
                'username': f'User_{user_id[:8]}',  # 简化的用户名
                'total_points': user_data['total_points'],
                'level': user_data['level']
            })
        
        # 按积分排序
        leaderboard.sort(key=lambda x: x['total_points'], reverse=True)
        
        # 添加排名
        for i, user in enumerate(leaderboard):
            user['rank'] = i + 1
        
        # 限制返回前50名
        leaderboard = leaderboard[:50]
        
        return jsonify({
            'success': True,
            'data': {
                'leaderboard': leaderboard,
                'total_users': len(points_data['users'])
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get leaderboard error: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'internal_error',
            'message': 'Failed to get leaderboard'
        }), 500

@points_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_user_stats():
    """获取用户积分统计"""
    try:
        user_id = get_jwt_identity()
        user_points = get_user_points(user_id)
        
        # 计算统计数据
        user_transactions = [
            t for t in points_data['transactions'] 
            if t['user_id'] == user_id
        ]
        
        total_earned = sum(t['amount'] for t in user_transactions if t['amount'] > 0)
        total_spent = sum(abs(t['amount']) for t in user_transactions if t['amount'] < 0)
        
        # 本月统计
        current_month = datetime.utcnow().strftime('%Y-%m')
        monthly_transactions = [
            t for t in user_transactions 
            if t['timestamp'].startswith(current_month)
        ]
        monthly_earned = sum(t['amount'] for t in monthly_transactions if t['amount'] > 0)
        
        return jsonify({
            'success': True,
            'data': {
                'current_balance': user_points['available_points'],
                'total_earned': total_earned,
                'total_spent': total_spent,
                'monthly_earned': monthly_earned,
                'level': user_points['level'],
                'achievements_count': len(user_points['achievements']),
                'transaction_count': len(user_transactions)
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get user stats error: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'internal_error',
            'message': 'Failed to get user stats'
        }), 500

