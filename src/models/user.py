"""
CultureBridge User Model - Enhanced with Points System
增强的用户模型，支持积分系统
"""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    """用户模型"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # 个人信息
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    avatar_url = db.Column(db.String(255))
    bio = db.Column(db.Text)
    
    # 积分系统相关字段
    total_points = db.Column(db.Integer, default=230)  # 总积分
    available_points = db.Column(db.Integer, default=230)  # 可用积分
    earned_today = db.Column(db.Integer, default=0)  # 今日获得积分
    learning_level = db.Column(db.String(20), default='Beginner')  # 学习等级
    cultural_achievements = db.Column(db.Integer, default=0)  # 文化成就数量
    
    # 钱包相关（保留原有区块链功能）
    wallet_address = db.Column(db.String(255))
    private_key_encrypted = db.Column(db.Text)
    
    # 订阅和会员
    subscription_type = db.Column(db.String(20), default='free')  # free, premium, enterprise
    subscription_expires = db.Column(db.DateTime)
    
    # 语言和文化偏好
    native_language = db.Column(db.String(10), default='en')
    learning_languages = db.Column(db.JSON)  # 正在学习的语言列表
    cultural_interests = db.Column(db.JSON)  # 文化兴趣标签
    
    # 时间戳
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    last_points_reset = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 状态字段
    is_active = db.Column(db.Boolean, default=True)
    is_verified = db.Column(db.Boolean, default=False)
    is_premium = db.Column(db.Boolean, default=False)
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def set_password(self, password):
        """设置密码"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """检查密码"""
        return check_password_hash(self.password_hash, password)
    
    def add_points(self, amount, reason=''):
        """增加积分"""
        self.total_points += amount
        self.available_points += amount
        self.earned_today += amount
        self.updated_at = datetime.utcnow()
        
        # 创建积分交易记录
        transaction = PointsTransaction(
            user_id=self.id,
            amount=amount,
            transaction_type='earned',
            description=reason or 'Points earned',
            balance_after=self.available_points
        )
        db.session.add(transaction)
        
        return transaction
    
    def spend_points(self, amount, reason=''):
        """消费积分"""
        if self.available_points < amount:
            raise ValueError('Insufficient points')
        
        self.available_points -= amount
        self.updated_at = datetime.utcnow()
        
        # 创建积分交易记录
        transaction = PointsTransaction(
            user_id=self.id,
            amount=-amount,
            transaction_type='spent',
            description=reason or 'Points spent',
            balance_after=self.available_points
        )
        db.session.add(transaction)
        
        return transaction
    
    def update_learning_level(self):
        """根据积分更新学习等级"""
        if self.total_points >= 10000:
            self.learning_level = 'Expert'
        elif self.total_points >= 5000:
            self.learning_level = 'Advanced'
        elif self.total_points >= 1000:
            self.learning_level = 'Intermediate'
        else:
            self.learning_level = 'Beginner'
    
    def reset_daily_points(self):
        """重置每日积分计数"""
        self.earned_today = 0
        self.last_points_reset = datetime.utcnow()
    
    def to_dict(self, include_sensitive=False):
        """转换为字典"""
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'avatar_url': self.avatar_url,
            'bio': self.bio,
            'total_points': self.total_points,
            'available_points': self.available_points,
            'earned_today': self.earned_today,
            'learning_level': self.learning_level,
            'cultural_achievements': self.cultural_achievements,
            'subscription_type': self.subscription_type,
            'native_language': self.native_language,
            'learning_languages': self.learning_languages or [],
            'cultural_interests': self.cultural_interests or [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'is_premium': self.is_premium
        }
        
        if include_sensitive:
            data.update({
                'wallet_address': self.wallet_address,
                'subscription_expires': self.subscription_expires.isoformat() if self.subscription_expires else None
            })
        
        return data

class PointsTransaction(db.Model):
    """积分交易记录模型"""
    __tablename__ = 'points_transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    amount = db.Column(db.Integer, nullable=False)  # 正数为获得，负数为消费
    transaction_type = db.Column(db.String(20), nullable=False)  # earned, spent, transferred
    description = db.Column(db.String(255))
    balance_after = db.Column(db.Integer, nullable=False)  # 交易后余额
    
    # 转账相关
    from_user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    to_user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # 时间戳
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关联关系
    user = db.relationship('User', foreign_keys=[user_id], backref='points_transactions')
    from_user = db.relationship('User', foreign_keys=[from_user_id])
    to_user = db.relationship('User', foreign_keys=[to_user_id])
    
    def __repr__(self):
        return f'<PointsTransaction {self.id}: {self.amount} points for user {self.user_id}>'
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'amount': self.amount,
            'transaction_type': self.transaction_type,
            'description': self.description,
            'balance_after': self.balance_after,
            'from_user_id': self.from_user_id,
            'to_user_id': self.to_user_id,
            'created_at': self.created_at.isoformat(),
            'date': self.created_at.strftime('%b %d, %Y')
        }

class Achievement(db.Model):
    """成就模型"""
    __tablename__ = 'achievements'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    icon = db.Column(db.String(50))  # emoji或图标名称
    points_reward = db.Column(db.Integer, default=0)
    category = db.Column(db.String(50))  # cultural, language, social, etc.
    
    # 解锁条件
    condition_type = db.Column(db.String(50))  # points_threshold, activity_count, etc.
    condition_value = db.Column(db.Integer)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Achievement {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon': self.icon,
            'points_reward': self.points_reward,
            'category': self.category,
            'condition_type': self.condition_type,
            'condition_value': self.condition_value
        }

class UserAchievement(db.Model):
    """用户成就关联模型"""
    __tablename__ = 'user_achievements'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    achievement_id = db.Column(db.Integer, db.ForeignKey('achievements.id'), nullable=False)
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关联关系
    user = db.relationship('User', backref='user_achievements')
    achievement = db.relationship('Achievement', backref='user_achievements')
    
    # 唯一约束
    __table_args__ = (db.UniqueConstraint('user_id', 'achievement_id'),)
    
    def __repr__(self):
        return f'<UserAchievement user:{self.user_id} achievement:{self.achievement_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'achievement_id': self.achievement_id,
            'earned_at': self.earned_at.isoformat(),
            'achievement': self.achievement.to_dict() if self.achievement else None
        }

