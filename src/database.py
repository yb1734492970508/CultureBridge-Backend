"""
CultureBridge Backend Database Models
数据库模型定义
"""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Float, Integer, Boolean, JSON, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# 创建基类
Base = declarative_base()

# 数据库配置
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///culturebridge.db')

# 创建数据库引擎
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 数据库会话
class DatabaseSession:
    def __init__(self):
        self.session = SessionLocal()
    
    def add(self, obj):
        self.session.add(obj)
    
    def commit(self):
        self.session.commit()
    
    def close(self):
        self.session.close()

# 创建全局数据库实例
db = DatabaseSession()

# 用户模型
class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    native_language = Column(String(10), default='en')
    total_translations = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# 语言模型
class Language(Base):
    __tablename__ = 'languages'
    
    id = Column(Integer, primary_key=True)
    code = Column(String(10), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    native_name = Column(String(100), nullable=False)
    flag_emoji = Column(String(10))
    is_active = Column(Boolean, default=True)

# 翻译记录模型
class Translation(Base):
    __tablename__ = 'translations'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    source_text = Column(Text, nullable=False)
    target_text = Column(Text, nullable=False)
    source_language = Column(String(10), nullable=False)
    target_language = Column(String(10), nullable=False)
    translation_method = Column(String(50), default='auto')
    confidence_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

# 实时翻译会话模型
class RealtimeSession(Base):
    __tablename__ = 'realtime_sessions'
    
    id = Column(Integer, primary_key=True)
    session_id = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    session_type = Column(String(50), nullable=False)
    source_language = Column(String(10), nullable=False)
    target_language = Column(String(10), nullable=False)
    status = Column(String(20), default='active')
    config = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    total_translations = Column(Integer, default=0)
    total_audio_duration = Column(Float, default=0.0)
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'user_id': self.user_id,
            'session_type': self.session_type,
            'source_language': self.source_language,
            'target_language': self.target_language,
            'status': self.status,
            'config': self.config,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'total_translations': self.total_translations,
            'total_audio_duration': self.total_audio_duration
        }

# 实时翻译记录模型
class RealtimeTranslation(Base):
    __tablename__ = 'realtime_translations'
    
    id = Column(Integer, primary_key=True)
    session_id = Column(String(255), nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    original_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=False)
    source_language = Column(String(10), nullable=False)
    target_language = Column(String(10), nullable=False)
    confidence_score = Column(Float, default=0.0)
    speech_confidence = Column(Float, default=0.0)
    audio_duration = Column(Float, default=0.0)
    processing_time = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'user_id': self.user_id,
            'original_text': self.original_text,
            'translated_text': self.translated_text,
            'source_language': self.source_language,
            'target_language': self.target_language,
            'confidence_score': self.confidence_score,
            'speech_confidence': self.speech_confidence,
            'audio_duration': self.audio_duration,
            'processing_time': self.processing_time,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# 语音通话会话模型
class VoiceCallSession(Base):
    __tablename__ = 'voice_call_sessions'
    
    id = Column(Integer, primary_key=True)
    session_id = Column(String(255), unique=True, nullable=False, index=True)
    caller_id = Column(String(255), nullable=False, index=True)
    callee_id = Column(String(255), nullable=False, index=True)
    caller_language = Column(String(10), nullable=False)
    callee_language = Column(String(10), nullable=False)
    status = Column(String(20), default='waiting')
    call_type = Column(String(20), default='random')
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    duration = Column(Integer, default=0)
    total_translations = Column(Integer, default=0)
    quality_rating = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'caller_id': self.caller_id,
            'callee_id': self.callee_id,
            'caller_language': self.caller_language,
            'callee_language': self.callee_language,
            'status': self.status,
            'call_type': self.call_type,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'duration': self.duration,
            'total_translations': self.total_translations,
            'quality_rating': self.quality_rating,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# 用户匹配偏好模型
class UserMatchingPreference(Base):
    __tablename__ = 'user_matching_preferences'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), unique=True, nullable=False, index=True)
    preferred_languages = Column(JSON)
    age_range = Column(JSON)
    interests = Column(JSON)
    availability_hours = Column(JSON)
    match_criteria = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'preferred_languages': self.preferred_languages,
            'age_range': self.age_range,
            'interests': self.interests,
            'availability_hours': self.availability_hours,
            'match_criteria': self.match_criteria,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# 创建所有表
def create_tables():
    Base.metadata.create_all(bind=engine)

# 初始化数据库
def init_database():
    create_tables()
    
    # 添加默认语言数据
    session = SessionLocal()
    
    # 检查是否已有语言数据
    if session.query(Language).count() == 0:
        languages = [
            Language(code='zh', name='Chinese', native_name='中文', flag_emoji='🇨🇳'),
            Language(code='en', name='English', native_name='English', flag_emoji='🇺🇸'),
            Language(code='es', name='Spanish', native_name='Español', flag_emoji='🇪🇸'),
            Language(code='fr', name='French', native_name='Français', flag_emoji='🇫🇷'),
            Language(code='de', name='German', native_name='Deutsch', flag_emoji='🇩🇪'),
            Language(code='ja', name='Japanese', native_name='日本語', flag_emoji='🇯🇵'),
            Language(code='ko', name='Korean', native_name='한국어', flag_emoji='🇰🇷'),
            Language(code='ar', name='Arabic', native_name='العربية', flag_emoji='🇸🇦'),
            Language(code='ru', name='Russian', native_name='Русский', flag_emoji='🇷🇺'),
            Language(code='pt', name='Portuguese', native_name='Português', flag_emoji='🇵🇹'),
            Language(code='it', name='Italian', native_name='Italiano', flag_emoji='🇮🇹'),
            Language(code='hi', name='Hindi', native_name='हिन्दी', flag_emoji='🇮🇳'),
            Language(code='th', name='Thai', native_name='ไทย', flag_emoji='🇹🇭'),
            Language(code='vi', name='Vietnamese', native_name='Tiếng Việt', flag_emoji='🇻🇳')
        ]
        
        for lang in languages:
            session.add(lang)
        
        session.commit()
    
    session.close()

if __name__ == '__main__':
    init_database()
    print("数据库初始化完成")

