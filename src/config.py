"""
CultureBridge Backend Configuration
增强版配置管理系统
"""

import os
import secrets
from datetime import timedelta
from typing import Optional, Dict, Any
from dataclasses import dataclass
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

@dataclass
class DatabaseConfig:
    """数据库配置"""
    # MongoDB配置
    MONGODB_URI: str = os.getenv(
        'MONGODB_URI', 
        'mongodb+srv://Culturebridge:Yibin199058@culturebridge.qrfsxrk.mongodb.net/?retryWrites=true&w=majority&appName=Culturebridge'
    )
    MONGODB_DB_NAME: str = os.getenv('MONGODB_DB_NAME', 'culturebridge')
    
    # SQLite配置（备用）
    SQLITE_URI: str = os.getenv('SQLITE_URI', 'sqlite:///culturebridge.db')
    
    # Redis配置
    REDIS_URL: str = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    REDIS_PASSWORD: Optional[str] = os.getenv('REDIS_PASSWORD')

@dataclass
class SecurityConfig:
    """安全配置"""
    SECRET_KEY: str = os.getenv('SECRET_KEY', secrets.token_urlsafe(32))
    JWT_SECRET_KEY: str = os.getenv('JWT_SECRET_KEY', secrets.token_urlsafe(32))
    JWT_ACCESS_TOKEN_EXPIRES: timedelta = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES: timedelta = timedelta(days=30)
    
    # 密码加密
    BCRYPT_LOG_ROUNDS: int = int(os.getenv('BCRYPT_LOG_ROUNDS', '12'))
    
    # CORS配置
    CORS_ORIGINS: list = os.getenv('CORS_ORIGINS', '*').split(',')
    
    # 速率限制
    RATELIMIT_STORAGE_URL: str = os.getenv('RATELIMIT_STORAGE_URL', 'redis://localhost:6379/1')

@dataclass
class AIConfig:
    """AI服务配置"""
    # OpenAI配置
    OPENAI_API_KEY: Optional[str] = os.getenv('OPENAI_API_KEY')
    OPENAI_MODEL: str = os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo')
    
    # Azure认知服务
    AZURE_SPEECH_KEY: Optional[str] = os.getenv('AZURE_SPEECH_KEY')
    AZURE_SPEECH_REGION: str = os.getenv('AZURE_SPEECH_REGION', 'eastus')
    
    # Google翻译
    GOOGLE_TRANSLATE_API_KEY: Optional[str] = os.getenv('GOOGLE_TRANSLATE_API_KEY')
    
    # Hugging Face
    HUGGINGFACE_API_KEY: Optional[str] = os.getenv('HUGGINGFACE_API_KEY')

@dataclass
class BlockchainConfig:
    """区块链配置"""
    # 以太坊配置
    ETH_RPC_URL: str = os.getenv('ETH_RPC_URL', 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID')
    ETH_PRIVATE_KEY: Optional[str] = os.getenv('ETH_PRIVATE_KEY')
    
    # 智能合约地址
    CULTURE_TOKEN_CONTRACT: Optional[str] = os.getenv('CULTURE_TOKEN_CONTRACT')
    LEARNING_REWARDS_CONTRACT: Optional[str] = os.getenv('LEARNING_REWARDS_CONTRACT')
    
    # 网络配置
    CHAIN_ID: int = int(os.getenv('CHAIN_ID', '1'))  # 1 for mainnet, 5 for goerli
    GAS_LIMIT: int = int(os.getenv('GAS_LIMIT', '200000'))

@dataclass
class EmailConfig:
    """邮件配置"""
    MAIL_SERVER: str = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT: int = int(os.getenv('MAIL_PORT', '587'))
    MAIL_USE_TLS: bool = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
    MAIL_USERNAME: Optional[str] = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD: Optional[str] = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER: Optional[str] = os.getenv('MAIL_DEFAULT_SENDER')

@dataclass
class CacheConfig:
    """缓存配置"""
    CACHE_TYPE: str = os.getenv('CACHE_TYPE', 'redis')
    CACHE_REDIS_URL: str = os.getenv('CACHE_REDIS_URL', 'redis://localhost:6379/2')
    CACHE_DEFAULT_TIMEOUT: int = int(os.getenv('CACHE_DEFAULT_TIMEOUT', '300'))

@dataclass
class CeleryConfig:
    """Celery任务队列配置"""
    CELERY_BROKER_URL: str = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/3')
    CELERY_RESULT_BACKEND: str = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/4')
    CELERY_TASK_SERIALIZER: str = 'json'
    CELERY_RESULT_SERIALIZER: str = 'json'
    CELERY_ACCEPT_CONTENT: list = ['json']
    CELERY_TIMEZONE: str = 'UTC'
    CELERY_ENABLE_UTC: bool = True

@dataclass
class LoggingConfig:
    """日志配置"""
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FORMAT: str = os.getenv('LOG_FORMAT', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    LOG_FILE: Optional[str] = os.getenv('LOG_FILE')
    LOG_MAX_BYTES: int = int(os.getenv('LOG_MAX_BYTES', '10485760'))  # 10MB
    LOG_BACKUP_COUNT: int = int(os.getenv('LOG_BACKUP_COUNT', '5'))

@dataclass
class FileStorageConfig:
    """文件存储配置"""
    UPLOAD_FOLDER: str = os.getenv('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH: int = int(os.getenv('MAX_CONTENT_LENGTH', '16777216'))  # 16MB
    ALLOWED_EXTENSIONS: set = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'mp3', 'wav', 'mp4'}
    
    # AWS S3配置
    AWS_ACCESS_KEY_ID: Optional[str] = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY: Optional[str] = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_S3_BUCKET: Optional[str] = os.getenv('AWS_S3_BUCKET')
    AWS_S3_REGION: str = os.getenv('AWS_S3_REGION', 'us-east-1')

class Config:
    """主配置类"""
    
    def __init__(self):
        self.database = DatabaseConfig()
        self.security = SecurityConfig()
        self.ai = AIConfig()
        self.blockchain = BlockchainConfig()
        self.email = EmailConfig()
        self.cache = CacheConfig()
        self.celery = CeleryConfig()
        self.logging = LoggingConfig()
        self.file_storage = FileStorageConfig()
        
        # 应用基础配置
        self.DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
        self.TESTING = os.getenv('TESTING', 'False').lower() == 'true'
        self.HOST = os.getenv('HOST', '0.0.0.0')
        self.PORT = int(os.getenv('PORT', '5000'))
        
        # API配置
        self.API_VERSION = os.getenv('API_VERSION', 'v1')
        self.API_TITLE = os.getenv('API_TITLE', 'CultureBridge API')
        self.API_DESCRIPTION = os.getenv('API_DESCRIPTION', 'CultureBridge Backend API')
        
        # 功能开关
        self.ENABLE_BLOCKCHAIN = os.getenv('ENABLE_BLOCKCHAIN', 'True').lower() == 'true'
        self.ENABLE_AI_TRANSLATION = os.getenv('ENABLE_AI_TRANSLATION', 'True').lower() == 'true'
        self.ENABLE_VOICE_FEATURES = os.getenv('ENABLE_VOICE_FEATURES', 'True').lower() == 'true'
        self.ENABLE_EMAIL_NOTIFICATIONS = os.getenv('ENABLE_EMAIL_NOTIFICATIONS', 'True').lower() == 'true'
        self.ENABLE_REAL_TIME_CHAT = os.getenv('ENABLE_REAL_TIME_CHAT', 'True').lower() == 'true'
        
        # 性能配置
        self.MAX_WORKERS = int(os.getenv('MAX_WORKERS', '4'))
        self.WORKER_TIMEOUT = int(os.getenv('WORKER_TIMEOUT', '30'))
        
    def get_flask_config(self) -> Dict[str, Any]:
        """获取Flask应用配置"""
        return {
            'SECRET_KEY': self.security.SECRET_KEY,
            'DEBUG': self.DEBUG,
            'TESTING': self.TESTING,
            
            # 数据库配置
            'SQLALCHEMY_DATABASE_URI': self.database.SQLITE_URI,
            'SQLALCHEMY_TRACK_MODIFICATIONS': False,
            'SQLALCHEMY_ENGINE_OPTIONS': {
                'pool_pre_ping': True,
                'pool_recycle': 300,
            },
            
            # JWT配置
            'JWT_SECRET_KEY': self.security.JWT_SECRET_KEY,
            'JWT_ACCESS_TOKEN_EXPIRES': self.security.JWT_ACCESS_TOKEN_EXPIRES,
            'JWT_REFRESH_TOKEN_EXPIRES': self.security.JWT_REFRESH_TOKEN_EXPIRES,
            
            # 邮件配置
            'MAIL_SERVER': self.email.MAIL_SERVER,
            'MAIL_PORT': self.email.MAIL_PORT,
            'MAIL_USE_TLS': self.email.MAIL_USE_TLS,
            'MAIL_USERNAME': self.email.MAIL_USERNAME,
            'MAIL_PASSWORD': self.email.MAIL_PASSWORD,
            'MAIL_DEFAULT_SENDER': self.email.MAIL_DEFAULT_SENDER,
            
            # 缓存配置
            'CACHE_TYPE': self.cache.CACHE_TYPE,
            'CACHE_REDIS_URL': self.cache.CACHE_REDIS_URL,
            'CACHE_DEFAULT_TIMEOUT': self.cache.CACHE_DEFAULT_TIMEOUT,
            
            # 文件上传配置
            'UPLOAD_FOLDER': self.file_storage.UPLOAD_FOLDER,
            'MAX_CONTENT_LENGTH': self.file_storage.MAX_CONTENT_LENGTH,
            
            # 速率限制
            'RATELIMIT_STORAGE_URL': self.security.RATELIMIT_STORAGE_URL,
        }
    
    def validate(self) -> bool:
        """验证配置的有效性"""
        errors = []
        
        # 检查必需的配置
        if not self.security.SECRET_KEY:
            errors.append("SECRET_KEY is required")
        
        if self.ENABLE_AI_TRANSLATION and not self.ai.OPENAI_API_KEY:
            errors.append("OPENAI_API_KEY is required when AI translation is enabled")
        
        if self.ENABLE_BLOCKCHAIN and not self.blockchain.ETH_RPC_URL:
            errors.append("ETH_RPC_URL is required when blockchain is enabled")
        
        if self.ENABLE_EMAIL_NOTIFICATIONS and not self.email.MAIL_USERNAME:
            errors.append("MAIL_USERNAME is required when email notifications are enabled")
        
        if errors:
            print("Configuration errors:")
            for error in errors:
                print(f"  - {error}")
            return False
        
        return True
    
    def get_feature_flags(self) -> Dict[str, bool]:
        """获取功能开关状态"""
        return {
            'blockchain': self.ENABLE_BLOCKCHAIN,
            'ai_translation': self.ENABLE_AI_TRANSLATION,
            'voice_features': self.ENABLE_VOICE_FEATURES,
            'email_notifications': self.ENABLE_EMAIL_NOTIFICATIONS,
            'real_time_chat': self.ENABLE_REAL_TIME_CHAT,
        }

# 全局配置实例
config = Config()

# 环境特定配置
class DevelopmentConfig(Config):
    def __init__(self):
        super().__init__()
        self.DEBUG = True
        self.TESTING = False

class ProductionConfig(Config):
    def __init__(self):
        super().__init__()
        self.DEBUG = False
        self.TESTING = False

class TestingConfig(Config):
    def __init__(self):
        super().__init__()
        self.DEBUG = True
        self.TESTING = True
        self.database.SQLITE_URI = 'sqlite:///:memory:'

# 根据环境选择配置
def get_config() -> Config:
    env = os.getenv('FLASK_ENV', 'development').lower()
    
    if env == 'production':
        return ProductionConfig()
    elif env == 'testing':
        return TestingConfig()
    else:
        return DevelopmentConfig()

# 导出配置
__all__ = ['Config', 'config', 'get_config']

