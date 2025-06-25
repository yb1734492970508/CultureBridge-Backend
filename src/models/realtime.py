"""
CultureBridge Backend Models - Realtime Translation
实时翻译相关的数据库模型
"""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Float, Integer, Boolean, JSON
from ..database import db

class RealtimeSession(db.Model):
    """实时翻译会话模型"""
    
    __tablename__ = 'realtime_sessions'
    
    id = Column(Integer, primary_key=True)
    session_id = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    session_type = Column(String(50), nullable=False)  # 'phone_audio', 'external_audio', 'voice_call'
    source_language = Column(String(10), nullable=False)
    target_language = Column(String(10), nullable=False)
    status = Column(String(20), default='active')  # 'active', 'completed', 'error'
    config = Column(JSON)  # 会话配置
    created_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    total_translations = Column(Integer, default=0)
    total_audio_duration = Column(Float, default=0.0)  # 总音频时长（秒）
    
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

class RealtimeTranslation(db.Model):
    """实时翻译记录模型"""
    
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
    audio_duration = Column(Float, default=0.0)  # 音频时长（秒）
    processing_time = Column(Float, default=0.0)  # 处理时间（秒）
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

class VoiceCallSession(db.Model):
    """语音通话会话模型"""
    
    __tablename__ = 'voice_call_sessions'
    
    id = Column(Integer, primary_key=True)
    session_id = Column(String(255), unique=True, nullable=False, index=True)
    caller_id = Column(String(255), nullable=False, index=True)
    callee_id = Column(String(255), nullable=False, index=True)
    caller_language = Column(String(10), nullable=False)
    callee_language = Column(String(10), nullable=False)
    status = Column(String(20), default='waiting')  # 'waiting', 'connected', 'ended', 'cancelled'
    call_type = Column(String(20), default='random')  # 'random', 'friend', 'group'
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    duration = Column(Integer, default=0)  # 通话时长（秒）
    total_translations = Column(Integer, default=0)
    quality_rating = Column(Float)  # 通话质量评分
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

class UserMatchingPreference(db.Model):
    """用户匹配偏好模型"""
    
    __tablename__ = 'user_matching_preferences'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), unique=True, nullable=False, index=True)
    preferred_languages = Column(JSON)  # 偏好的语言列表
    age_range = Column(JSON)  # 年龄范围 {'min': 18, 'max': 65}
    interests = Column(JSON)  # 兴趣标签列表
    availability_hours = Column(JSON)  # 可用时间段
    match_criteria = Column(JSON)  # 匹配标准
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

