"""
CultureBridge Backend Database Models
增强版数据库模型定义
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid
import json

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import event
import sqlalchemy as sa

db = SQLAlchemy()

class TimestampMixin:
    """时间戳混入类"""
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), 
                          onupdate=lambda: datetime.now(timezone.utc), nullable=False)

class UUIDMixin:
    """UUID混入类"""
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

# 枚举类型
class UserRole(Enum):
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class UserStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    BANNED = "banned"

class LanguageLevel(Enum):
    BEGINNER = "beginner"
    ELEMENTARY = "elementary"
    INTERMEDIATE = "intermediate"
    UPPER_INTERMEDIATE = "upper_intermediate"
    ADVANCED = "advanced"
    PROFICIENT = "proficient"

class ContentType(Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    DOCUMENT = "document"

class TransactionType(Enum):
    EARN = "earn"
    SPEND = "spend"
    TRANSFER = "transfer"
    REWARD = "reward"
    PENALTY = "penalty"

class NotificationType(Enum):
    MESSAGE = "message"
    FRIEND_REQUEST = "friend_request"
    LEARNING_REMINDER = "learning_reminder"
    ACHIEVEMENT = "achievement"
    SYSTEM = "system"

# 关联表
user_friends = db.Table('user_friends',
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True),
    db.Column('friend_id', db.String(36), db.ForeignKey('users.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=lambda: datetime.now(timezone.utc))
)

user_languages = db.Table('user_languages',
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True),
    db.Column('language_id', db.String(36), db.ForeignKey('languages.id'), primary_key=True),
    db.Column('level', db.Enum(LanguageLevel), nullable=False),
    db.Column('is_native', db.Boolean, default=False),
    db.Column('created_at', db.DateTime, default=lambda: datetime.now(timezone.utc))
)

conversation_participants = db.Table('conversation_participants',
    db.Column('conversation_id', db.String(36), db.ForeignKey('conversations.id'), primary_key=True),
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True),
    db.Column('joined_at', db.DateTime, default=lambda: datetime.now(timezone.utc)),
    db.Column('last_read_at', db.DateTime, default=lambda: datetime.now(timezone.utc))
)

class User(UUIDMixin, TimestampMixin, db.Model):
    """用户模型"""
    __tablename__ = 'users'
    
    # 基本信息
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # 个人资料
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    display_name = db.Column(db.String(100))
    bio = db.Column(db.Text)
    avatar_url = db.Column(db.String(255))
    cover_url = db.Column(db.String(255))
    
    # 联系信息
    phone = db.Column(db.String(20))
    country = db.Column(db.String(100))
    city = db.Column(db.String(100))
    timezone = db.Column(db.String(50), default='UTC')
    
    # 账户状态
    role = db.Column(db.Enum(UserRole), default=UserRole.USER, nullable=False)
    status = db.Column(db.Enum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    is_verified = db.Column(db.Boolean, default=False)
    is_premium = db.Column(db.Boolean, default=False)
    
    # 学习统计
    total_points = db.Column(db.Integer, default=0)
    learning_streak = db.Column(db.Integer, default=0)
    total_translations = db.Column(db.Integer, default=0)
    total_conversations = db.Column(db.Integer, default=0)
    
    # 偏好设置
    preferred_language = db.Column(db.String(10), default='en')
    notification_settings = db.Column(db.JSON, default=lambda: {
        'email': True,
        'push': True,
        'learning_reminders': True,
        'friend_requests': True,
        'messages': True
    })
    privacy_settings = db.Column(db.JSON, default=lambda: {
        'profile_visibility': 'public',
        'show_online_status': True,
        'allow_friend_requests': True,
        'show_learning_progress': True
    })
    
    # 区块链信息
    wallet_address = db.Column(db.String(42))
    wallet_private_key_encrypted = db.Column(db.Text)
    
    # 时间戳
    last_login_at = db.Column(db.DateTime)
    last_active_at = db.Column(db.DateTime)
    email_verified_at = db.Column(db.DateTime)
    
    # 关系
    languages = db.relationship('Language', secondary=user_languages, backref='users')
    friends = db.relationship('User', 
                             secondary=user_friends,
                             primaryjoin=id == user_friends.c.user_id,
                             secondaryjoin=id == user_friends.c.friend_id,
                             backref='friend_of')
    
    # 反向关系
    sent_messages = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender')
    received_messages = db.relationship('Message', foreign_keys='Message.recipient_id', backref='recipient')
    translations = db.relationship('Translation', backref='user')
    learning_sessions = db.relationship('LearningSession', backref='user')
    achievements = db.relationship('UserAchievement', backref='user')
    transactions = db.relationship('PointTransaction', backref='user')
    notifications = db.relationship('Notification', backref='user')
    
    def set_password(self, password: str):
        """设置密码"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password: str) -> bool:
        """验证密码"""
        return check_password_hash(self.password_hash, password)
    
    def get_full_name(self) -> str:
        """获取全名"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.display_name or self.username
    
    def add_points(self, amount: int, transaction_type: TransactionType, description: str = ""):
        """添加积分"""
        self.total_points += amount
        transaction = PointTransaction(
            user_id=self.id,
            amount=amount,
            transaction_type=transaction_type,
            description=description
        )
        db.session.add(transaction)
    
    def can_afford(self, amount: int) -> bool:
        """检查是否有足够积分"""
        return self.total_points >= amount
    
    def spend_points(self, amount: int, description: str = "") -> bool:
        """消费积分"""
        if not self.can_afford(amount):
            return False
        
        self.total_points -= amount
        transaction = PointTransaction(
            user_id=self.id,
            amount=-amount,
            transaction_type=TransactionType.SPEND,
            description=description
        )
        db.session.add(transaction)
        return True
    
    def to_dict(self, include_private: bool = False) -> Dict[str, Any]:
        """转换为字典"""
        data = {
            'id': self.id,
            'username': self.username,
            'display_name': self.get_full_name(),
            'bio': self.bio,
            'avatar_url': self.avatar_url,
            'country': self.country,
            'city': self.city,
            'total_points': self.total_points,
            'learning_streak': self.learning_streak,
            'is_verified': self.is_verified,
            'is_premium': self.is_premium,
            'created_at': self.created_at.isoformat(),
            'last_active_at': self.last_active_at.isoformat() if self.last_active_at else None
        }
        
        if include_private:
            data.update({
                'email': self.email,
                'phone': self.phone,
                'role': self.role.value,
                'status': self.status.value,
                'notification_settings': self.notification_settings,
                'privacy_settings': self.privacy_settings,
                'wallet_address': self.wallet_address
            })
        
        return data

class Language(UUIDMixin, TimestampMixin, db.Model):
    """语言模型"""
    __tablename__ = 'languages'
    
    code = db.Column(db.String(10), unique=True, nullable=False, index=True)  # ISO 639-1
    name = db.Column(db.String(100), nullable=False)
    native_name = db.Column(db.String(100))
    flag_emoji = db.Column(db.String(10))
    is_active = db.Column(db.Boolean, default=True)
    
    # 统计信息
    total_speakers = db.Column(db.Integer, default=0)
    learning_difficulty = db.Column(db.Integer, default=1)  # 1-5
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'native_name': self.native_name,
            'flag_emoji': self.flag_emoji,
            'total_speakers': self.total_speakers,
            'learning_difficulty': self.learning_difficulty
        }

class Conversation(UUIDMixin, TimestampMixin, db.Model):
    """对话模型"""
    __tablename__ = 'conversations'
    
    title = db.Column(db.String(200))
    is_group = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    
    # 群组信息
    description = db.Column(db.Text)
    avatar_url = db.Column(db.String(255))
    max_participants = db.Column(db.Integer, default=100)
    
    # 设置
    settings = db.Column(db.JSON, default=lambda: {
        'auto_translate': True,
        'allow_voice_messages': True,
        'allow_file_sharing': True,
        'moderation_enabled': False
    })
    
    # 关系
    participants = db.relationship('User', secondary=conversation_participants, backref='conversations')
    messages = db.relationship('Message', backref='conversation', cascade='all, delete-orphan')
    
    def get_participant_count(self) -> int:
        """获取参与者数量"""
        return len(self.participants)
    
    def add_participant(self, user: User):
        """添加参与者"""
        if user not in self.participants and len(self.participants) < self.max_participants:
            self.participants.append(user)
    
    def remove_participant(self, user: User):
        """移除参与者"""
        if user in self.participants:
            self.participants.remove(user)
    
    def to_dict(self, current_user_id: str = None) -> Dict[str, Any]:
        return {
            'id': self.id,
            'title': self.title,
            'is_group': self.is_group,
            'participant_count': self.get_participant_count(),
            'avatar_url': self.avatar_url,
            'description': self.description,
            'settings': self.settings,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Message(UUIDMixin, TimestampMixin, db.Model):
    """消息模型"""
    __tablename__ = 'messages'
    
    conversation_id = db.Column(db.String(36), db.ForeignKey('conversations.id'), nullable=False)
    sender_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    recipient_id = db.Column(db.String(36), db.ForeignKey('users.id'))  # 私聊时使用
    
    # 消息内容
    content = db.Column(db.Text, nullable=False)
    content_type = db.Column(db.Enum(ContentType), default=ContentType.TEXT)
    original_language = db.Column(db.String(10))
    
    # 翻译内容
    translations = db.Column(db.JSON, default=dict)  # {language_code: translated_text}
    
    # 文件信息
    file_url = db.Column(db.String(255))
    file_name = db.Column(db.String(255))
    file_size = db.Column(db.Integer)
    file_type = db.Column(db.String(50))
    
    # 消息状态
    is_edited = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    edited_at = db.Column(db.DateTime)
    
    # 回复信息
    reply_to_id = db.Column(db.String(36), db.ForeignKey('messages.id'))
    reply_to = db.relationship('Message', remote_side=[id], backref='replies')
    
    def add_translation(self, language_code: str, translated_text: str):
        """添加翻译"""
        if not self.translations:
            self.translations = {}
        self.translations[language_code] = translated_text
        db.session.commit()
    
    def get_translation(self, language_code: str) -> Optional[str]:
        """获取翻译"""
        return self.translations.get(language_code) if self.translations else None
    
    def to_dict(self, target_language: str = None) -> Dict[str, Any]:
        content = self.content
        if target_language and target_language != self.original_language:
            translated = self.get_translation(target_language)
            if translated:
                content = translated
        
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'sender_id': self.sender_id,
            'content': content,
            'content_type': self.content_type.value,
            'original_language': self.original_language,
            'file_url': self.file_url,
            'file_name': self.file_name,
            'is_edited': self.is_edited,
            'reply_to_id': self.reply_to_id,
            'created_at': self.created_at.isoformat(),
            'edited_at': self.edited_at.isoformat() if self.edited_at else None
        }

class Translation(UUIDMixin, TimestampMixin, db.Model):
    """翻译记录模型"""
    __tablename__ = 'translations'
    
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    
    # 翻译内容
    source_text = db.Column(db.Text, nullable=False)
    target_text = db.Column(db.Text, nullable=False)
    source_language = db.Column(db.String(10), nullable=False)
    target_language = db.Column(db.String(10), nullable=False)
    
    # 翻译方式
    translation_method = db.Column(db.String(50))  # 'ai', 'google', 'azure'
    confidence_score = db.Column(db.Float)
    
    # 用户反馈
    user_rating = db.Column(db.Integer)  # 1-5
    user_feedback = db.Column(db.Text)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'source_text': self.source_text,
            'target_text': self.target_text,
            'source_language': self.source_language,
            'target_language': self.target_language,
            'translation_method': self.translation_method,
            'confidence_score': self.confidence_score,
            'user_rating': self.user_rating,
            'created_at': self.created_at.isoformat()
        }

class LearningSession(UUIDMixin, TimestampMixin, db.Model):
    """学习会话模型"""
    __tablename__ = 'learning_sessions'
    
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    language_id = db.Column(db.String(36), db.ForeignKey('languages.id'), nullable=False)
    
    # 会话信息
    session_type = db.Column(db.String(50))  # 'vocabulary', 'grammar', 'conversation', 'pronunciation'
    duration_minutes = db.Column(db.Integer)
    points_earned = db.Column(db.Integer, default=0)
    
    # 学习内容
    content = db.Column(db.JSON)  # 学习的具体内容
    progress = db.Column(db.JSON)  # 学习进度
    
    # 结果统计
    total_questions = db.Column(db.Integer, default=0)
    correct_answers = db.Column(db.Integer, default=0)
    accuracy_rate = db.Column(db.Float)
    
    # 关系
    language = db.relationship('Language', backref='learning_sessions')
    
    def calculate_accuracy(self):
        """计算准确率"""
        if self.total_questions > 0:
            self.accuracy_rate = self.correct_answers / self.total_questions
        else:
            self.accuracy_rate = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'session_type': self.session_type,
            'duration_minutes': self.duration_minutes,
            'points_earned': self.points_earned,
            'total_questions': self.total_questions,
            'correct_answers': self.correct_answers,
            'accuracy_rate': self.accuracy_rate,
            'created_at': self.created_at.isoformat()
        }

class Achievement(UUIDMixin, TimestampMixin, db.Model):
    """成就模型"""
    __tablename__ = 'achievements'
    
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    icon_url = db.Column(db.String(255))
    category = db.Column(db.String(50))  # 'learning', 'social', 'translation', 'streak'
    
    # 解锁条件
    unlock_criteria = db.Column(db.JSON)  # 解锁条件的JSON配置
    points_reward = db.Column(db.Integer, default=0)
    
    # 稀有度
    rarity = db.Column(db.String(20), default='common')  # 'common', 'rare', 'epic', 'legendary'
    is_active = db.Column(db.Boolean, default=True)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon_url': self.icon_url,
            'category': self.category,
            'points_reward': self.points_reward,
            'rarity': self.rarity
        }

class UserAchievement(UUIDMixin, TimestampMixin, db.Model):
    """用户成就模型"""
    __tablename__ = 'user_achievements'
    
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    achievement_id = db.Column(db.String(36), db.ForeignKey('achievements.id'), nullable=False)
    
    # 解锁信息
    unlocked_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    progress = db.Column(db.JSON)  # 进度信息
    
    # 关系
    achievement = db.relationship('Achievement', backref='user_achievements')
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'achievement': self.achievement.to_dict(),
            'unlocked_at': self.unlocked_at.isoformat(),
            'progress': self.progress
        }

class PointTransaction(UUIDMixin, TimestampMixin, db.Model):
    """积分交易模型"""
    __tablename__ = 'point_transactions'
    
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    transaction_type = db.Column(db.Enum(TransactionType), nullable=False)
    description = db.Column(db.String(255))
    
    # 关联信息
    related_id = db.Column(db.String(36))  # 关联的对象ID（如学习会话、翻译等）
    related_type = db.Column(db.String(50))  # 关联的对象类型
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'amount': self.amount,
            'transaction_type': self.transaction_type.value,
            'description': self.description,
            'created_at': self.created_at.isoformat()
        }

class Notification(UUIDMixin, TimestampMixin, db.Model):
    """通知模型"""
    __tablename__ = 'notifications'
    
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    
    # 通知内容
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text)
    notification_type = db.Column(db.Enum(NotificationType), nullable=False)
    
    # 状态
    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime)
    
    # 关联信息
    related_id = db.Column(db.String(36))
    related_type = db.Column(db.String(50))
    
    # 额外数据
    data = db.Column(db.JSON)
    
    def mark_as_read(self):
        """标记为已读"""
        self.is_read = True
        self.read_at = datetime.now(timezone.utc)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'title': self.title,
            'message': self.message,
            'notification_type': self.notification_type.value,
            'is_read': self.is_read,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'data': self.data,
            'created_at': self.created_at.isoformat()
        }

# 事件监听器
@event.listens_for(User, 'before_insert')
def set_user_defaults(mapper, connection, target):
    """设置用户默认值"""
    if not target.display_name:
        target.display_name = target.username

@event.listens_for(Message, 'after_insert')
def update_conversation_timestamp(mapper, connection, target):
    """更新对话时间戳"""
    # 这里可以添加更新对话最后活动时间的逻辑
    pass

# 数据库初始化函数
def init_db():
    """初始化数据库"""
    db.create_all()
    
    # 创建默认语言
    default_languages = [
        {'code': 'en', 'name': 'English', 'native_name': 'English', 'flag_emoji': '🇺🇸'},
        {'code': 'zh', 'name': 'Chinese', 'native_name': '中文', 'flag_emoji': '🇨🇳'},
        {'code': 'es', 'name': 'Spanish', 'native_name': 'Español', 'flag_emoji': '🇪🇸'},
        {'code': 'fr', 'name': 'French', 'native_name': 'Français', 'flag_emoji': '🇫🇷'},
        {'code': 'de', 'name': 'German', 'native_name': 'Deutsch', 'flag_emoji': '🇩🇪'},
        {'code': 'ja', 'name': 'Japanese', 'native_name': '日本語', 'flag_emoji': '🇯🇵'},
        {'code': 'ko', 'name': 'Korean', 'native_name': '한국어', 'flag_emoji': '🇰🇷'},
        {'code': 'ar', 'name': 'Arabic', 'native_name': 'العربية', 'flag_emoji': '🇸🇦'},
        {'code': 'ru', 'name': 'Russian', 'native_name': 'Русский', 'flag_emoji': '🇷🇺'},
        {'code': 'pt', 'name': 'Portuguese', 'native_name': 'Português', 'flag_emoji': '🇵🇹'},
    ]
    
    for lang_data in default_languages:
        existing = Language.query.filter_by(code=lang_data['code']).first()
        if not existing:
            language = Language(**lang_data)
            db.session.add(language)
    
    # 创建默认成就
    default_achievements = [
        {
            'name': '初学者',
            'description': '完成第一次学习会话',
            'category': 'learning',
            'points_reward': 10,
            'rarity': 'common',
            'unlock_criteria': {'learning_sessions': 1}
        },
        {
            'name': '翻译新手',
            'description': '完成第一次翻译',
            'category': 'translation',
            'points_reward': 5,
            'rarity': 'common',
            'unlock_criteria': {'translations': 1}
        },
        {
            'name': '社交达人',
            'description': '添加第一个朋友',
            'category': 'social',
            'points_reward': 15,
            'rarity': 'common',
            'unlock_criteria': {'friends': 1}
        },
        {
            'name': '坚持不懈',
            'description': '连续学习7天',
            'category': 'streak',
            'points_reward': 50,
            'rarity': 'rare',
            'unlock_criteria': {'learning_streak': 7}
        }
    ]
    
    for achievement_data in default_achievements:
        existing = Achievement.query.filter_by(name=achievement_data['name']).first()
        if not existing:
            achievement = Achievement(**achievement_data)
            db.session.add(achievement)
    
    db.session.commit()

# 导出所有模型
__all__ = [
    'db', 'User', 'Language', 'Conversation', 'Message', 'Translation',
    'LearningSession', 'Achievement', 'UserAchievement', 'PointTransaction',
    'Notification', 'UserRole', 'UserStatus', 'LanguageLevel', 'ContentType',
    'TransactionType', 'NotificationType', 'init_db'
]

