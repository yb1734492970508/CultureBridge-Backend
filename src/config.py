"""
CultureBridge Backend Configuration
配置文件
"""

import os
from dataclasses import dataclass

@dataclass
class AIConfig:
    OPENAI_API_KEY: str = os.getenv('OPENAI_API_KEY', '')
    OPENAI_MODEL: str = os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo')
    AZURE_SPEECH_KEY: str = os.getenv('AZURE_SPEECH_KEY', '')
    AZURE_SPEECH_REGION: str = os.getenv('AZURE_SPEECH_REGION', 'eastus')
    GOOGLE_TRANSLATE_API_KEY: str = os.getenv('GOOGLE_TRANSLATE_API_KEY', '')

@dataclass
class DatabaseConfig:
    MONGODB_URI: str = os.getenv('MONGODB_URI', 'mongodb+srv://Culturebridge:Yibin199058@culturebridge.qrfsxrk.mongodb.net/?retryWrites=true&w=majority&appName=Culturebridge')
    REDIS_URL: str = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

@dataclass
class AppConfig:
    SECRET_KEY: str = os.getenv('SECRET_KEY', 'culturebridge-secret-key-2024')
    JWT_SECRET_KEY: str = os.getenv('JWT_SECRET_KEY', 'jwt-secret-string')
    DEBUG: bool = os.getenv('FLASK_ENV') == 'development'

class Config:
    ai = AIConfig()
    database = DatabaseConfig()
    app = AppConfig()

config = Config()

