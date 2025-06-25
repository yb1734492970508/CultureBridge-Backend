"""
CultureBridge Backend Database Configuration - Enhanced with MongoDB and Points System
增强的数据库配置，支持MongoDB和积分系统
"""

import os
from datetime import datetime
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseConfig:
    """数据库配置类"""
    
    def __init__(self):
        # MongoDB配置
        self.mongodb_uri = os.getenv(
            'MONGODB_URI', 
            'mongodb+srv://Culturebridge:Yibin199058@culturebridge.qrfsxrk.mongodb.net/?retryWrites=true&w=majority&appName=Culturebridge'
        )
        self.database_name = os.getenv('DATABASE_NAME', 'culturebridge')
        
        # 连接配置
        self.connection_timeout = 10000  # 10秒
        self.server_selection_timeout = 5000  # 5秒
        
        # 初始化连接
        self.client = None
        self.db = None
        self.connect()
    
    def connect(self):
        """连接到MongoDB"""
        try:
            self.client = MongoClient(
                self.mongodb_uri,
                serverSelectionTimeoutMS=self.server_selection_timeout,
                connectTimeoutMS=self.connection_timeout,
                retryWrites=True,
                w='majority'
            )
            
            # 测试连接
            self.client.admin.command('ping')
            self.db = self.client[self.database_name]
            
            logger.info(f"Successfully connected to MongoDB: {self.database_name}")
            return True
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error connecting to MongoDB: {str(e)}")
            return False
    
    def get_collection(self, collection_name):
        """获取集合"""
        if not self.db:
            if not self.connect():
                raise Exception("Database connection not available")
        return self.db[collection_name]
    
    def close(self):
        """关闭连接"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

# 全局数据库实例
db_config = DatabaseConfig()

class UserModel:
    """用户模型"""
    
    def __init__(self):
        self.collection = db_config.get_collection('users')
    
    def create_user(self, user_data):
        """创建用户"""
        user_data.update({
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'total_points': 230,  # 默认积分
            'available_points': 230,
            'earned_today': 0,
            'learning_level': 'Beginner',
            'cultural_achievements': 0,
            'subscription_type': 'free',
            'is_active': True,
            'is_verified': False,
            'is_premium': False
        })
        
        result = self.collection.insert_one(user_data)
        return str(result.inserted_id)
    
    def get_user_by_id(self, user_id):
        """根据ID获取用户"""
        return self.collection.find_one({'_id': user_id})
    
    def get_user_by_email(self, email):
        """根据邮箱获取用户"""
        return self.collection.find_one({'email': email})
    
    def update_user(self, user_id, update_data):
        """更新用户信息"""
        update_data['updated_at'] = datetime.utcnow()
        return self.collection.update_one(
            {'_id': user_id},
            {'$set': update_data}
        )
    
    def add_points(self, user_id, amount, reason=''):
        """增加用户积分"""
        return self.collection.update_one(
            {'_id': user_id},
            {
                '$inc': {
                    'total_points': amount,
                    'available_points': amount,
                    'earned_today': amount
                },
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
    
    def spend_points(self, user_id, amount):
        """消费用户积分"""
        user = self.get_user_by_id(user_id)
        if not user or user.get('available_points', 0) < amount:
            return False
        
        return self.collection.update_one(
            {'_id': user_id},
            {
                '$inc': {'available_points': -amount},
                '$set': {'updated_at': datetime.utcnow()}
            }
        )

class PointsTransactionModel:
    """积分交易模型"""
    
    def __init__(self):
        self.collection = db_config.get_collection('points_transactions')
    
    def create_transaction(self, transaction_data):
        """创建交易记录"""
        transaction_data.update({
            'created_at': datetime.utcnow(),
            'date': datetime.utcnow().strftime('%b %d, %Y')
        })
        
        result = self.collection.insert_one(transaction_data)
        return str(result.inserted_id)
    
    def get_user_transactions(self, user_id, limit=10, skip=0):
        """获取用户交易记录"""
        return list(self.collection.find(
            {'user_id': user_id}
        ).sort('created_at', -1).limit(limit).skip(skip))
    
    def get_transaction_stats(self, user_id):
        """获取用户交易统计"""
        pipeline = [
            {'$match': {'user_id': user_id}},
            {'$group': {
                '_id': None,
                'total_earned': {
                    '$sum': {
                        '$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]
                    }
                },
                'total_spent': {
                    '$sum': {
                        '$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]
                    }
                },
                'transaction_count': {'$sum': 1}
            }}
        ]
        
        result = list(self.collection.aggregate(pipeline))
        return result[0] if result else {
            'total_earned': 0,
            'total_spent': 0,
            'transaction_count': 0
        }

class AchievementModel:
    """成就模型"""
    
    def __init__(self):
        self.collection = db_config.get_collection('achievements')
        self.user_achievements = db_config.get_collection('user_achievements')
    
    def create_achievement(self, achievement_data):
        """创建成就"""
        achievement_data['created_at'] = datetime.utcnow()
        result = self.collection.insert_one(achievement_data)
        return str(result.inserted_id)
    
    def get_all_achievements(self):
        """获取所有成就"""
        return list(self.collection.find())
    
    def get_user_achievements(self, user_id):
        """获取用户成就"""
        return list(self.user_achievements.find({'user_id': user_id}))
    
    def award_achievement(self, user_id, achievement_id):
        """授予用户成就"""
        # 检查是否已经获得
        existing = self.user_achievements.find_one({
            'user_id': user_id,
            'achievement_id': achievement_id
        })
        
        if existing:
            return False
        
        # 添加成就记录
        self.user_achievements.insert_one({
            'user_id': user_id,
            'achievement_id': achievement_id,
            'earned_at': datetime.utcnow()
        })
        
        return True

class CulturalContentModel:
    """文化内容模型"""
    
    def __init__(self):
        self.collection = db_config.get_collection('cultural_content')
    
    def create_content(self, content_data):
        """创建文化内容"""
        content_data.update({
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'views': 0,
            'likes': 0,
            'shares': 0
        })
        
        result = self.collection.insert_one(content_data)
        return str(result.inserted_id)
    
    def get_content_feed(self, limit=10, skip=0):
        """获取内容信息流"""
        return list(self.collection.find().sort('created_at', -1).limit(limit).skip(skip))
    
    def get_content_by_id(self, content_id):
        """根据ID获取内容"""
        return self.collection.find_one({'_id': content_id})
    
    def update_content_stats(self, content_id, action):
        """更新内容统计"""
        if action in ['view', 'like', 'share']:
            return self.collection.update_one(
                {'_id': content_id},
                {'$inc': {f'{action}s': 1}}
            )
        return False

class ChatModel:
    """聊天模型"""
    
    def __init__(self):
        self.collection = db_config.get_collection('chat_messages')
        self.rooms = db_config.get_collection('chat_rooms')
    
    def create_room(self, room_data):
        """创建聊天室"""
        room_data.update({
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'message_count': 0
        })
        
        result = self.rooms.insert_one(room_data)
        return str(result.inserted_id)
    
    def send_message(self, message_data):
        """发送消息"""
        message_data.update({
            'created_at': datetime.utcnow(),
            'is_read': False
        })
        
        result = self.collection.insert_one(message_data)
        
        # 更新房间统计
        self.rooms.update_one(
            {'_id': message_data['room_id']},
            {
                '$inc': {'message_count': 1},
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        
        return str(result.inserted_id)
    
    def get_room_messages(self, room_id, limit=50, skip=0):
        """获取房间消息"""
        return list(self.collection.find(
            {'room_id': room_id}
        ).sort('created_at', -1).limit(limit).skip(skip))

def init_database():
    """初始化数据库"""
    try:
        # 测试连接
        if not db_config.connect():
            raise Exception("Failed to connect to database")
        
        # 创建索引
        user_model = UserModel()
        user_model.collection.create_index('email', unique=True)
        user_model.collection.create_index('username')
        
        points_model = PointsTransactionModel()
        points_model.collection.create_index('user_id')
        points_model.collection.create_index('created_at')
        
        # 初始化默认成就
        achievement_model = AchievementModel()
        existing_achievements = achievement_model.get_all_achievements()
        
        if not existing_achievements:
            default_achievements = [
                {
                    'name': 'Cultural Explorer',
                    'description': 'Share your first cultural content',
                    'icon': '🌍',
                    'points_reward': 100,
                    'category': 'cultural',
                    'condition_type': 'content_share',
                    'condition_value': 1
                },
                {
                    'name': 'Language Master',
                    'description': 'Complete 10 language practice sessions',
                    'icon': '🗣️',
                    'points_reward': 200,
                    'category': 'language',
                    'condition_type': 'practice_sessions',
                    'condition_value': 10
                },
                {
                    'name': 'Community Builder',
                    'description': 'Help 5 community members',
                    'icon': '👥',
                    'points_reward': 150,
                    'category': 'social',
                    'condition_type': 'community_help',
                    'condition_value': 5
                },
                {
                    'name': 'Tradition Keeper',
                    'description': 'Document 3 cultural traditions',
                    'icon': '🏛️',
                    'points_reward': 300,
                    'category': 'cultural',
                    'condition_type': 'tradition_documentation',
                    'condition_value': 3
                }
            ]
            
            for achievement in default_achievements:
                achievement_model.create_achievement(achievement)
        
        logger.info("Database initialization completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        return False

def get_database():
    """获取数据库实例"""
    return db_config.db

def close_database():
    """关闭数据库连接"""
    db_config.close()

# 模型实例
user_model = UserModel()
points_transaction_model = PointsTransactionModel()
achievement_model = AchievementModel()
cultural_content_model = CulturalContentModel()
chat_model = ChatModel()

if __name__ == '__main__':
    init_database()
    print("数据库配置和初始化完成")

