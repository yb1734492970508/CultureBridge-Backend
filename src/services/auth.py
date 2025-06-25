"""
CultureBridge Backend Authentication Service
增强版认证服务，支持多种认证方式
"""

import jwt
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
from functools import wraps

from flask import request, jsonify, current_app
from flask_jwt_extended import JWTManager, create_access_token, create_refresh_token, get_jwt_identity, verify_jwt_in_request
from werkzeug.security import generate_password_hash, check_password_hash
from cryptography.fernet import Fernet
import requests
from web3 import Web3

from src.models import db, User, UserRole, UserStatus
from src.config import config

class AuthenticationError(Exception):
    """认证错误"""
    pass

class AuthorizationError(Exception):
    """授权错误"""
    pass

class AuthService:
    """认证服务类"""
    
    def __init__(self):
        self.jwt_manager = JWTManager()
        self.encryption_key = Fernet.generate_key()
        self.cipher_suite = Fernet(self.encryption_key)
        
        # Web3实例（用于区块链认证）
        if config.ENABLE_BLOCKCHAIN:
            self.w3 = Web3(Web3.HTTPProvider(config.blockchain.ETH_RPC_URL))
    
    def init_app(self, app):
        """初始化Flask应用"""
        self.jwt_manager.init_app(app)
        
        # JWT配置
        app.config['JWT_SECRET_KEY'] = config.security.JWT_SECRET_KEY
        app.config['JWT_ACCESS_TOKEN_EXPIRES'] = config.security.JWT_ACCESS_TOKEN_EXPIRES
        app.config['JWT_REFRESH_TOKEN_EXPIRES'] = config.security.JWT_REFRESH_TOKEN_EXPIRES
        
        # JWT回调函数
        @self.jwt_manager.user_identity_loader
        def user_identity_lookup(user):
            return user.id if hasattr(user, 'id') else user
        
        @self.jwt_manager.user_lookup_loader
        def user_lookup_callback(_jwt_header, jwt_data):
            identity = jwt_data["sub"]
            return User.query.filter_by(id=identity).one_or_none()
        
        @self.jwt_manager.expired_token_loader
        def expired_token_callback(jwt_header, jwt_payload):
            return jsonify({
                'error': 'token_expired',
                'message': 'Token has expired'
            }), 401
        
        @self.jwt_manager.invalid_token_loader
        def invalid_token_callback(error):
            return jsonify({
                'error': 'invalid_token',
                'message': 'Invalid token'
            }), 401
        
        @self.jwt_manager.unauthorized_loader
        def missing_token_callback(error):
            return jsonify({
                'error': 'authorization_required',
                'message': 'Request does not contain an access token'
            }), 401
    
    def register_user(self, username: str, email: str, password: str, **kwargs) -> Tuple[User, str, str]:
        """注册新用户"""
        # 检查用户名和邮箱是否已存在
        if User.query.filter_by(username=username).first():
            raise AuthenticationError("Username already exists")
        
        if User.query.filter_by(email=email).first():
            raise AuthenticationError("Email already exists")
        
        # 验证密码强度
        if not self._validate_password_strength(password):
            raise AuthenticationError("Password does not meet security requirements")
        
        # 创建新用户
        user = User(
            username=username,
            email=email,
            **kwargs
        )
        user.set_password(password)
        
        # 生成钱包地址（如果启用区块链功能）
        if config.ENABLE_BLOCKCHAIN:
            wallet_address, private_key = self._generate_wallet()
            user.wallet_address = wallet_address
            user.wallet_private_key_encrypted = self._encrypt_private_key(private_key)
        
        db.session.add(user)
        db.session.commit()
        
        # 生成JWT令牌
        access_token = create_access_token(identity=user)
        refresh_token = create_refresh_token(identity=user)
        
        return user, access_token, refresh_token
    
    def authenticate_user(self, identifier: str, password: str) -> Tuple[User, str, str]:
        """用户名/邮箱密码认证"""
        # 查找用户（支持用户名或邮箱）
        user = User.query.filter(
            (User.username == identifier) | (User.email == identifier)
        ).first()
        
        if not user or not user.check_password(password):
            raise AuthenticationError("Invalid credentials")
        
        if user.status != UserStatus.ACTIVE:
            raise AuthenticationError(f"Account is {user.status.value}")
        
        # 更新最后登录时间
        user.last_login_at = datetime.now(timezone.utc)
        user.last_active_at = datetime.now(timezone.utc)
        db.session.commit()
        
        # 生成JWT令牌
        access_token = create_access_token(identity=user)
        refresh_token = create_refresh_token(identity=user)
        
        return user, access_token, refresh_token
    
    def authenticate_wallet(self, wallet_address: str, signature: str, message: str) -> Tuple[User, str, str]:
        """区块链钱包认证"""
        if not config.ENABLE_BLOCKCHAIN:
            raise AuthenticationError("Blockchain authentication is disabled")
        
        # 验证签名
        if not self._verify_wallet_signature(wallet_address, signature, message):
            raise AuthenticationError("Invalid wallet signature")
        
        # 查找或创建用户
        user = User.query.filter_by(wallet_address=wallet_address).first()
        
        if not user:
            # 创建新用户
            username = f"wallet_{wallet_address[:8]}"
            email = f"{wallet_address}@wallet.local"
            
            user = User(
                username=username,
                email=email,
                wallet_address=wallet_address,
                is_verified=True  # 钱包用户自动验证
            )
            # 设置随机密码（钱包用户不使用密码登录）
            user.set_password(secrets.token_urlsafe(32))
            
            db.session.add(user)
            db.session.commit()
        
        if user.status != UserStatus.ACTIVE:
            raise AuthenticationError(f"Account is {user.status.value}")
        
        # 更新最后登录时间
        user.last_login_at = datetime.now(timezone.utc)
        user.last_active_at = datetime.now(timezone.utc)
        db.session.commit()
        
        # 生成JWT令牌
        access_token = create_access_token(identity=user)
        refresh_token = create_refresh_token(identity=user)
        
        return user, access_token, refresh_token
    
    def authenticate_oauth(self, provider: str, access_token: str) -> Tuple[User, str, str]:
        """OAuth第三方认证"""
        user_info = self._get_oauth_user_info(provider, access_token)
        
        if not user_info:
            raise AuthenticationError("Failed to get user info from OAuth provider")
        
        # 查找或创建用户
        oauth_id = user_info.get('id')
        email = user_info.get('email')
        
        user = User.query.filter_by(email=email).first()
        
        if not user:
            # 创建新用户
            username = user_info.get('username') or f"{provider}_{oauth_id}"
            
            user = User(
                username=username,
                email=email,
                first_name=user_info.get('first_name'),
                last_name=user_info.get('last_name'),
                avatar_url=user_info.get('avatar_url'),
                is_verified=True  # OAuth用户自动验证
            )
            # 设置随机密码（OAuth用户不使用密码登录）
            user.set_password(secrets.token_urlsafe(32))
            
            db.session.add(user)
            db.session.commit()
        
        if user.status != UserStatus.ACTIVE:
            raise AuthenticationError(f"Account is {user.status.value}")
        
        # 更新最后登录时间
        user.last_login_at = datetime.now(timezone.utc)
        user.last_active_at = datetime.now(timezone.utc)
        db.session.commit()
        
        # 生成JWT令牌
        access_token = create_access_token(identity=user)
        refresh_token = create_refresh_token(identity=user)
        
        return user, access_token, refresh_token
    
    def refresh_token(self, refresh_token: str) -> str:
        """刷新访问令牌"""
        try:
            # 验证刷新令牌
            payload = jwt.decode(
                refresh_token,
                config.security.JWT_SECRET_KEY,
                algorithms=['HS256']
            )
            
            user_id = payload.get('sub')
            user = User.query.get(user_id)
            
            if not user or user.status != UserStatus.ACTIVE:
                raise AuthenticationError("Invalid refresh token")
            
            # 生成新的访问令牌
            new_access_token = create_access_token(identity=user)
            return new_access_token
            
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Refresh token has expired")
        except jwt.InvalidTokenError:
            raise AuthenticationError("Invalid refresh token")
    
    def logout_user(self, user_id: str):
        """用户登出"""
        # 这里可以实现令牌黑名单功能
        # 目前只更新最后活动时间
        user = User.query.get(user_id)
        if user:
            user.last_active_at = datetime.now(timezone.utc)
            db.session.commit()
    
    def reset_password(self, email: str) -> str:
        """重置密码"""
        user = User.query.filter_by(email=email).first()
        if not user:
            raise AuthenticationError("User not found")
        
        # 生成重置令牌
        reset_token = self._generate_reset_token(user)
        
        # 这里应该发送重置邮件
        # send_password_reset_email(user, reset_token)
        
        return reset_token
    
    def confirm_password_reset(self, token: str, new_password: str) -> bool:
        """确认密码重置"""
        user_id = self._verify_reset_token(token)
        if not user_id:
            raise AuthenticationError("Invalid or expired reset token")
        
        user = User.query.get(user_id)
        if not user:
            raise AuthenticationError("User not found")
        
        if not self._validate_password_strength(new_password):
            raise AuthenticationError("Password does not meet security requirements")
        
        user.set_password(new_password)
        db.session.commit()
        
        return True
    
    def change_password(self, user_id: str, old_password: str, new_password: str) -> bool:
        """修改密码"""
        user = User.query.get(user_id)
        if not user:
            raise AuthenticationError("User not found")
        
        if not user.check_password(old_password):
            raise AuthenticationError("Invalid current password")
        
        if not self._validate_password_strength(new_password):
            raise AuthenticationError("Password does not meet security requirements")
        
        user.set_password(new_password)
        db.session.commit()
        
        return True
    
    def verify_email(self, token: str) -> bool:
        """验证邮箱"""
        user_id = self._verify_email_token(token)
        if not user_id:
            raise AuthenticationError("Invalid or expired verification token")
        
        user = User.query.get(user_id)
        if not user:
            raise AuthenticationError("User not found")
        
        user.is_verified = True
        user.email_verified_at = datetime.now(timezone.utc)
        db.session.commit()
        
        return True
    
    def _validate_password_strength(self, password: str) -> bool:
        """验证密码强度"""
        if len(password) < 8:
            return False
        
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)
        
        return sum([has_upper, has_lower, has_digit, has_special]) >= 3
    
    def _generate_wallet(self) -> Tuple[str, str]:
        """生成钱包地址和私钥"""
        if not config.ENABLE_BLOCKCHAIN:
            return None, None
        
        account = self.w3.eth.account.create()
        return account.address, account.privateKey.hex()
    
    def _encrypt_private_key(self, private_key: str) -> str:
        """加密私钥"""
        return self.cipher_suite.encrypt(private_key.encode()).decode()
    
    def _decrypt_private_key(self, encrypted_private_key: str) -> str:
        """解密私钥"""
        return self.cipher_suite.decrypt(encrypted_private_key.encode()).decode()
    
    def _verify_wallet_signature(self, wallet_address: str, signature: str, message: str) -> bool:
        """验证钱包签名"""
        try:
            # 恢复签名者地址
            message_hash = self.w3.keccak(text=message)
            recovered_address = self.w3.eth.account.recover_message(
                message_hash, signature=signature
            )
            
            return recovered_address.lower() == wallet_address.lower()
        except Exception:
            return False
    
    def _get_oauth_user_info(self, provider: str, access_token: str) -> Optional[Dict[str, Any]]:
        """获取OAuth用户信息"""
        if provider == 'google':
            response = requests.get(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                headers={'Authorization': f'Bearer {access_token}'}
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    'id': data.get('id'),
                    'email': data.get('email'),
                    'first_name': data.get('given_name'),
                    'last_name': data.get('family_name'),
                    'avatar_url': data.get('picture'),
                    'username': data.get('email', '').split('@')[0]
                }
        
        elif provider == 'github':
            response = requests.get(
                'https://api.github.com/user',
                headers={'Authorization': f'token {access_token}'}
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    'id': str(data.get('id')),
                    'email': data.get('email'),
                    'first_name': data.get('name', '').split(' ')[0] if data.get('name') else '',
                    'last_name': ' '.join(data.get('name', '').split(' ')[1:]) if data.get('name') else '',
                    'avatar_url': data.get('avatar_url'),
                    'username': data.get('login')
                }
        
        return None
    
    def _generate_reset_token(self, user: User) -> str:
        """生成密码重置令牌"""
        payload = {
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(hours=1),
            'type': 'password_reset'
        }
        return jwt.encode(payload, config.security.SECRET_KEY, algorithm='HS256')
    
    def _verify_reset_token(self, token: str) -> Optional[str]:
        """验证密码重置令牌"""
        try:
            payload = jwt.decode(token, config.security.SECRET_KEY, algorithms=['HS256'])
            if payload.get('type') == 'password_reset':
                return payload.get('user_id')
        except jwt.ExpiredSignatureError:
            pass
        except jwt.InvalidTokenError:
            pass
        return None
    
    def _generate_email_token(self, user: User) -> str:
        """生成邮箱验证令牌"""
        payload = {
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(days=1),
            'type': 'email_verification'
        }
        return jwt.encode(payload, config.security.SECRET_KEY, algorithm='HS256')
    
    def _verify_email_token(self, token: str) -> Optional[str]:
        """验证邮箱验证令牌"""
        try:
            payload = jwt.decode(token, config.security.SECRET_KEY, algorithms=['HS256'])
            if payload.get('type') == 'email_verification':
                return payload.get('user_id')
        except jwt.ExpiredSignatureError:
            pass
        except jwt.InvalidTokenError:
            pass
        return None

# 全局认证服务实例
auth_service = AuthService()

# 装饰器函数
def login_required(f):
    """登录必需装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({
                'error': 'authentication_required',
                'message': str(e)
            }), 401
    return decorated_function

def role_required(*roles):
    """角色必需装饰器"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                verify_jwt_in_request()
                current_user_id = get_jwt_identity()
                user = User.query.get(current_user_id)
                
                if not user or user.role not in roles:
                    raise AuthorizationError("Insufficient permissions")
                
                return f(*args, **kwargs)
            except AuthorizationError as e:
                return jsonify({
                    'error': 'authorization_required',
                    'message': str(e)
                }), 403
            except Exception as e:
                return jsonify({
                    'error': 'authentication_required',
                    'message': str(e)
                }), 401
        return decorated_function
    return decorator

def admin_required(f):
    """管理员必需装饰器"""
    return role_required(UserRole.ADMIN, UserRole.SUPER_ADMIN)(f)

def get_current_user() -> Optional[User]:
    """获取当前用户"""
    try:
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
        return User.query.get(current_user_id)
    except Exception:
        return None

# 导出
__all__ = [
    'AuthService', 'auth_service', 'AuthenticationError', 'AuthorizationError',
    'login_required', 'role_required', 'admin_required', 'get_current_user'
]

