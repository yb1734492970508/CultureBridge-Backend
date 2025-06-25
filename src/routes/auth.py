"""
CultureBridge Backend Authentication Routes
认证相关的API路由
"""

from flask import Blueprint, request, jsonify, current_app
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import asyncio

from src.services.auth import auth_service, AuthenticationError, get_current_user, login_required
from src.models import db, User

# 创建蓝图
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """用户注册"""
    
    try:
        data = request.get_json()
        
        # 验证必需字段
        required_fields = ['username', 'email', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'error': 'missing_field',
                    'message': f'Field {field} is required'
                }), 400
        
        # 提取用户信息
        username = data['username'].strip()
        email = data['email'].strip().lower()
        password = data['password']
        
        # 可选字段
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        country = data.get('country', '').strip()
        city = data.get('city', '').strip()
        preferred_language = data.get('preferred_language', 'en')
        
        # 注册用户
        user, access_token, refresh_token = auth_service.register_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            country=country,
            city=city,
            preferred_language=preferred_language
        )
        
        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict(include_private=True),
            'access_token': access_token,
            'refresh_token': refresh_token
        }), 201
        
    except AuthenticationError as e:
        return jsonify({
            'error': 'registration_failed',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Registration error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Registration failed due to internal error'
        }), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """用户登录"""
    
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('identifier') or not data.get('password'):
            return jsonify({
                'error': 'missing_credentials',
                'message': 'Username/email and password are required'
            }), 400
        
        identifier = data['identifier'].strip()
        password = data['password']
        
        # 认证用户
        user, access_token, refresh_token = auth_service.authenticate_user(
            identifier=identifier,
            password=password
        )
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(include_private=True),
            'access_token': access_token,
            'refresh_token': refresh_token
        }), 200
        
    except AuthenticationError as e:
        return jsonify({
            'error': 'authentication_failed',
            'message': str(e)
        }), 401
    except Exception as e:
        current_app.logger.error(f'Login error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Login failed due to internal error'
        }), 500

@auth_bp.route('/wallet-login', methods=['POST'])
def wallet_login():
    """钱包登录"""
    
    try:
        data = request.get_json()
        
        # 验证必需字段
        required_fields = ['wallet_address', 'signature', 'message']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'error': 'missing_field',
                    'message': f'Field {field} is required'
                }), 400
        
        wallet_address = data['wallet_address'].strip()
        signature = data['signature']
        message = data['message']
        
        # 钱包认证
        user, access_token, refresh_token = auth_service.authenticate_wallet(
            wallet_address=wallet_address,
            signature=signature,
            message=message
        )
        
        return jsonify({
            'message': 'Wallet login successful',
            'user': user.to_dict(include_private=True),
            'access_token': access_token,
            'refresh_token': refresh_token
        }), 200
        
    except AuthenticationError as e:
        return jsonify({
            'error': 'wallet_authentication_failed',
            'message': str(e)
        }), 401
    except Exception as e:
        current_app.logger.error(f'Wallet login error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Wallet login failed due to internal error'
        }), 500

@auth_bp.route('/oauth-login', methods=['POST'])
def oauth_login():
    """OAuth第三方登录"""
    
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('provider') or not data.get('access_token'):
            return jsonify({
                'error': 'missing_oauth_data',
                'message': 'Provider and access_token are required'
            }), 400
        
        provider = data['provider'].lower()
        access_token = data['access_token']
        
        # 支持的OAuth提供商
        if provider not in ['google', 'github']:
            return jsonify({
                'error': 'unsupported_provider',
                'message': f'OAuth provider {provider} is not supported'
            }), 400
        
        # OAuth认证
        user, jwt_access_token, refresh_token = auth_service.authenticate_oauth(
            provider=provider,
            access_token=access_token
        )
        
        return jsonify({
            'message': f'{provider.title()} login successful',
            'user': user.to_dict(include_private=True),
            'access_token': jwt_access_token,
            'refresh_token': refresh_token
        }), 200
        
    except AuthenticationError as e:
        return jsonify({
            'error': 'oauth_authentication_failed',
            'message': str(e)
        }), 401
    except Exception as e:
        current_app.logger.error(f'OAuth login error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'OAuth login failed due to internal error'
        }), 500

@auth_bp.route('/refresh', methods=['POST'])
def refresh_token():
    """刷新访问令牌"""
    
    try:
        data = request.get_json()
        
        if not data.get('refresh_token'):
            return jsonify({
                'error': 'missing_refresh_token',
                'message': 'Refresh token is required'
            }), 400
        
        refresh_token = data['refresh_token']
        
        # 刷新令牌
        new_access_token = auth_service.refresh_token(refresh_token)
        
        return jsonify({
            'message': 'Token refreshed successfully',
            'access_token': new_access_token
        }), 200
        
    except AuthenticationError as e:
        return jsonify({
            'error': 'token_refresh_failed',
            'message': str(e)
        }), 401
    except Exception as e:
        current_app.logger.error(f'Token refresh error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Token refresh failed due to internal error'
        }), 500

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """用户登出"""
    
    try:
        current_user = get_current_user()
        
        if current_user:
            auth_service.logout_user(current_user.id)
        
        return jsonify({
            'message': 'Logout successful'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Logout error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Logout failed due to internal error'
        }), 500

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """忘记密码"""
    
    try:
        data = request.get_json()
        
        if not data.get('email'):
            return jsonify({
                'error': 'missing_email',
                'message': 'Email is required'
            }), 400
        
        email = data['email'].strip().lower()
        
        # 生成重置令牌
        reset_token = auth_service.reset_password(email)
        
        # 这里应该发送重置邮件
        # 目前只返回成功消息
        
        return jsonify({
            'message': 'Password reset email sent',
            'reset_token': reset_token  # 在生产环境中不应该返回令牌
        }), 200
        
    except AuthenticationError as e:
        return jsonify({
            'error': 'password_reset_failed',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Password reset error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Password reset failed due to internal error'
        }), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """重置密码"""
    
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('token') or not data.get('new_password'):
            return jsonify({
                'error': 'missing_data',
                'message': 'Reset token and new password are required'
            }), 400
        
        token = data['token']
        new_password = data['new_password']
        
        # 确认密码重置
        success = auth_service.confirm_password_reset(token, new_password)
        
        if success:
            return jsonify({
                'message': 'Password reset successful'
            }), 200
        else:
            return jsonify({
                'error': 'password_reset_failed',
                'message': 'Failed to reset password'
            }), 400
        
    except AuthenticationError as e:
        return jsonify({
            'error': 'password_reset_failed',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Password reset confirmation error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Password reset failed due to internal error'
        }), 500

@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """修改密码"""
    
    try:
        current_user = get_current_user()
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('old_password') or not data.get('new_password'):
            return jsonify({
                'error': 'missing_passwords',
                'message': 'Old password and new password are required'
            }), 400
        
        old_password = data['old_password']
        new_password = data['new_password']
        
        # 修改密码
        success = auth_service.change_password(
            user_id=current_user.id,
            old_password=old_password,
            new_password=new_password
        )
        
        if success:
            return jsonify({
                'message': 'Password changed successfully'
            }), 200
        else:
            return jsonify({
                'error': 'password_change_failed',
                'message': 'Failed to change password'
            }), 400
        
    except AuthenticationError as e:
        return jsonify({
            'error': 'password_change_failed',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Password change error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Password change failed due to internal error'
        }), 500

@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """验证邮箱"""
    
    try:
        data = request.get_json()
        
        if not data.get('token'):
            return jsonify({
                'error': 'missing_token',
                'message': 'Verification token is required'
            }), 400
        
        token = data['token']
        
        # 验证邮箱
        success = auth_service.verify_email(token)
        
        if success:
            return jsonify({
                'message': 'Email verified successfully'
            }), 200
        else:
            return jsonify({
                'error': 'email_verification_failed',
                'message': 'Failed to verify email'
            }), 400
        
    except AuthenticationError as e:
        return jsonify({
            'error': 'email_verification_failed',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Email verification error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Email verification failed due to internal error'
        }), 500

@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user_info():
    """获取当前用户信息"""
    
    try:
        current_user = get_current_user()
        
        if not current_user:
            return jsonify({
                'error': 'user_not_found',
                'message': 'Current user not found'
            }), 404
        
        return jsonify({
            'user': current_user.to_dict(include_private=True)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get current user error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get user information'
        }), 500

@auth_bp.route('/check-username', methods=['POST'])
def check_username():
    """检查用户名是否可用"""
    
    try:
        data = request.get_json()
        
        if not data.get('username'):
            return jsonify({
                'error': 'missing_username',
                'message': 'Username is required'
            }), 400
        
        username = data['username'].strip()
        
        # 检查用户名是否已存在
        existing_user = User.query.filter_by(username=username).first()
        
        return jsonify({
            'username': username,
            'available': existing_user is None
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Check username error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to check username availability'
        }), 500

@auth_bp.route('/check-email', methods=['POST'])
def check_email():
    """检查邮箱是否可用"""
    
    try:
        data = request.get_json()
        
        if not data.get('email'):
            return jsonify({
                'error': 'missing_email',
                'message': 'Email is required'
            }), 400
        
        email = data['email'].strip().lower()
        
        # 检查邮箱是否已存在
        existing_user = User.query.filter_by(email=email).first()
        
        return jsonify({
            'email': email,
            'available': existing_user is None
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Check email error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to check email availability'
        }), 500

