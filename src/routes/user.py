"""
CultureBridge Backend User Routes
用户相关的API路由
"""

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import get_jwt_identity
import asyncio

from src.services.auth import login_required, get_current_user
from src.models import db, User, UserRole, Language, user_languages

# 创建蓝图
user_bp = Blueprint('user', __name__)

@user_bp.route('/', methods=['GET'])
@login_required
def get_users():
    """获取用户列表"""
    
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        search = request.args.get('search', '').strip()
        
        # 构建查询
        query = User.query
        
        if search:
            query = query.filter(
                (User.username.contains(search)) |
                (User.display_name.contains(search)) |
                (User.email.contains(search))
            )
        
        # 分页查询
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        users = [user.to_dict() for user in pagination.items]
        
        return jsonify({
            'users': users,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get users error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get users'
        }), 500

@user_bp.route('/<user_id>', methods=['GET'])
@login_required
def get_user(user_id):
    """获取用户详情"""
    
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'error': 'user_not_found',
                'message': 'User not found'
            }), 404
        
        current_user = get_current_user()
        include_private = current_user and current_user.id == user_id
        
        return jsonify({
            'user': user.to_dict(include_private=include_private)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get user error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get user'
        }), 500

@user_bp.route('/<user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    """更新用户信息"""
    
    try:
        current_user = get_current_user()
        
        # 检查权限
        if current_user.id != user_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
            return jsonify({
                'error': 'permission_denied',
                'message': 'You can only update your own profile'
            }), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'error': 'user_not_found',
                'message': 'User not found'
            }), 404
        
        data = request.get_json()
        
        # 可更新的字段
        updatable_fields = [
            'first_name', 'last_name', 'display_name', 'bio',
            'phone', 'country', 'city', 'timezone',
            'preferred_language', 'notification_settings', 'privacy_settings'
        ]
        
        # 管理员可以更新更多字段
        if current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
            updatable_fields.extend(['role', 'status', 'is_verified', 'is_premium'])
        
        # 更新字段
        for field in updatable_fields:
            if field in data:
                setattr(user, field, data[field])
        
        db.session.commit()
        
        return jsonify({
            'message': 'User updated successfully',
            'user': user.to_dict(include_private=True)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Update user error: {str(e)}')
        db.session.rollback()
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to update user'
        }), 500

@user_bp.route('/<user_id>/languages', methods=['GET'])
@login_required
def get_user_languages(user_id):
    """获取用户语言"""
    
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'error': 'user_not_found',
                'message': 'User not found'
            }), 404
        
        # 获取用户语言关联
        user_lang_query = db.session.query(
            Language, user_languages.c.level, user_languages.c.is_native
        ).join(
            user_languages, Language.id == user_languages.c.language_id
        ).filter(
            user_languages.c.user_id == user_id
        )
        
        languages = []
        for lang, level, is_native in user_lang_query:
            lang_dict = lang.to_dict()
            lang_dict['level'] = level.value if level else None
            lang_dict['is_native'] = is_native
            languages.append(lang_dict)
        
        return jsonify({
            'languages': languages
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get user languages error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get user languages'
        }), 500

@user_bp.route('/<user_id>/languages', methods=['POST'])
@login_required
def add_user_language(user_id):
    """添加用户语言"""
    
    try:
        current_user = get_current_user()
        
        # 检查权限
        if current_user.id != user_id:
            return jsonify({
                'error': 'permission_denied',
                'message': 'You can only manage your own languages'
            }), 403
        
        data = request.get_json()
        
        if not data.get('language_id') or not data.get('level'):
            return jsonify({
                'error': 'missing_data',
                'message': 'Language ID and level are required'
            }), 400
        
        language_id = data['language_id']
        level = data['level']
        is_native = data.get('is_native', False)
        
        # 检查语言是否存在
        language = Language.query.get(language_id)
        if not language:
            return jsonify({
                'error': 'language_not_found',
                'message': 'Language not found'
            }), 404
        
        # 检查是否已添加
        existing = db.session.query(user_languages).filter_by(
            user_id=user_id,
            language_id=language_id
        ).first()
        
        if existing:
            return jsonify({
                'error': 'language_already_added',
                'message': 'Language already added'
            }), 400
        
        # 添加语言
        stmt = user_languages.insert().values(
            user_id=user_id,
            language_id=language_id,
            level=level,
            is_native=is_native
        )
        db.session.execute(stmt)
        db.session.commit()
        
        return jsonify({
            'message': 'Language added successfully'
        }), 201
        
    except Exception as e:
        current_app.logger.error(f'Add user language error: {str(e)}')
        db.session.rollback()
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to add language'
        }), 500

@user_bp.route('/<user_id>/friends', methods=['GET'])
@login_required
def get_user_friends(user_id):
    """获取用户朋友列表"""
    
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'error': 'user_not_found',
                'message': 'User not found'
            }), 404
        
        friends = [friend.to_dict() for friend in user.friends]
        
        return jsonify({
            'friends': friends,
            'total': len(friends)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get user friends error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get friends'
        }), 500

@user_bp.route('/<user_id>/friends/<friend_id>', methods=['POST'])
@login_required
def add_friend(user_id, friend_id):
    """添加朋友"""
    
    try:
        current_user = get_current_user()
        
        # 检查权限
        if current_user.id != user_id:
            return jsonify({
                'error': 'permission_denied',
                'message': 'You can only manage your own friends'
            }), 403
        
        # 不能添加自己为朋友
        if user_id == friend_id:
            return jsonify({
                'error': 'invalid_operation',
                'message': 'Cannot add yourself as friend'
            }), 400
        
        user = User.query.get(user_id)
        friend = User.query.get(friend_id)
        
        if not user or not friend:
            return jsonify({
                'error': 'user_not_found',
                'message': 'User or friend not found'
            }), 404
        
        # 检查是否已经是朋友
        if friend in user.friends:
            return jsonify({
                'error': 'already_friends',
                'message': 'Already friends'
            }), 400
        
        # 添加朋友关系（双向）
        user.friends.append(friend)
        friend.friends.append(user)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Friend added successfully'
        }), 201
        
    except Exception as e:
        current_app.logger.error(f'Add friend error: {str(e)}')
        db.session.rollback()
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to add friend'
        }), 500

@user_bp.route('/<user_id>/friends/<friend_id>', methods=['DELETE'])
@login_required
def remove_friend(user_id, friend_id):
    """移除朋友"""
    
    try:
        current_user = get_current_user()
        
        # 检查权限
        if current_user.id != user_id:
            return jsonify({
                'error': 'permission_denied',
                'message': 'You can only manage your own friends'
            }), 403
        
        user = User.query.get(user_id)
        friend = User.query.get(friend_id)
        
        if not user or not friend:
            return jsonify({
                'error': 'user_not_found',
                'message': 'User or friend not found'
            }), 404
        
        # 检查是否是朋友
        if friend not in user.friends:
            return jsonify({
                'error': 'not_friends',
                'message': 'Not friends'
            }), 400
        
        # 移除朋友关系（双向）
        user.friends.remove(friend)
        friend.friends.remove(user)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Friend removed successfully'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Remove friend error: {str(e)}')
        db.session.rollback()
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to remove friend'
        }), 500

@user_bp.route('/<user_id>/stats', methods=['GET'])
@login_required
def get_user_stats(user_id):
    """获取用户统计信息"""
    
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'error': 'user_not_found',
                'message': 'User not found'
            }), 404
        
        # 基础统计
        stats = {
            'total_points': user.total_points,
            'learning_streak': user.learning_streak,
            'total_translations': user.total_translations,
            'total_conversations': user.total_conversations,
            'friends_count': len(user.friends),
            'languages_count': len(user.languages),
            'achievements_count': len(user.achievements)
        }
        
        # 如果是当前用户，提供更详细的统计
        current_user = get_current_user()
        if current_user and current_user.id == user_id:
            # 这里可以添加更详细的统计信息
            pass
        
        return jsonify({
            'stats': stats
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get user stats error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get user stats'
        }), 500

@user_bp.route('/search', methods=['GET'])
@login_required
def search_users():
    """搜索用户"""
    
    try:
        query = request.args.get('q', '').strip()
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        
        if not query:
            return jsonify({
                'error': 'missing_query',
                'message': 'Search query is required'
            }), 400
        
        # 搜索用户
        users_query = User.query.filter(
            (User.username.contains(query)) |
            (User.display_name.contains(query)) |
            (User.first_name.contains(query)) |
            (User.last_name.contains(query))
        )
        
        pagination = users_query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        users = [user.to_dict() for user in pagination.items]
        
        return jsonify({
            'users': users,
            'query': query,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Search users error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to search users'
        }), 500

