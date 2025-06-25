"""
CultureBridge Points Reward System
积分奖励系统
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
from flask import Blueprint, request, jsonify

class PointsActionType(Enum):
    """积分行为类型"""
    DAILY_LOGIN = "daily_login"
    COMPLETE_LESSON = "complete_lesson"
    CHAT_SESSION = "chat_session"
    AI_TUTOR_SESSION = "ai_tutor_session"
    HELP_OTHER_USER = "help_other_user"
    SHARE_CONTENT = "share_content"
    WRITE_REVIEW = "write_review"
    INVITE_FRIEND = "invite_friend"
    COMPLETE_CHALLENGE = "complete_challenge"
    STREAK_BONUS = "streak_bonus"

class RewardType(Enum):
    """奖励类型"""
    POINTS = "points"
    BADGE = "badge"
    PREMIUM_TRIAL = "premium_trial"
    DISCOUNT_COUPON = "discount_coupon"
    EXCLUSIVE_CONTENT = "exclusive_content"

@dataclass
class PointsRule:
    """积分规则"""
    action_type: PointsActionType
    points: int
    daily_limit: Optional[int] = None
    description: str = ""
    multiplier_conditions: Dict[str, float] = None

@dataclass
class Badge:
    """徽章"""
    badge_id: str
    name: str
    description: str
    icon: str
    rarity: str  # common, rare, epic, legendary
    unlock_condition: str
    points_value: int

@dataclass
class UserPoints:
    """用户积分记录"""
    user_id: str
    total_points: int
    available_points: int
    level: int
    current_streak: int
    longest_streak: int
    last_activity_date: str
    badges: List[str]

@dataclass
class PointsTransaction:
    """积分交易记录"""
    transaction_id: str
    user_id: str
    action_type: PointsActionType
    points_change: int
    description: str
    timestamp: datetime
    metadata: Dict[str, Any]

class PointsRewardService:
    """积分奖励服务类"""
    
    def __init__(self):
        # 模拟数据存储
        self.user_points = {}
        self.transactions = {}
        self.badges = {}
        self.daily_activities = {}
        
        # 初始化积分规则
        self.points_rules = {
            PointsActionType.DAILY_LOGIN: PointsRule(
                action_type=PointsActionType.DAILY_LOGIN,
                points=10,
                daily_limit=1,
                description="每日登录奖励",
                multiplier_conditions={"streak_7": 1.5, "streak_30": 2.0}
            ),
            PointsActionType.COMPLETE_LESSON: PointsRule(
                action_type=PointsActionType.COMPLETE_LESSON,
                points=20,
                daily_limit=10,
                description="完成课程学习"
            ),
            PointsActionType.CHAT_SESSION: PointsRule(
                action_type=PointsActionType.CHAT_SESSION,
                points=15,
                daily_limit=5,
                description="参与聊天交流"
            ),
            PointsActionType.AI_TUTOR_SESSION: PointsRule(
                action_type=PointsActionType.AI_TUTOR_SESSION,
                points=30,
                daily_limit=3,
                description="AI导师会话"
            ),
            PointsActionType.HELP_OTHER_USER: PointsRule(
                action_type=PointsActionType.HELP_OTHER_USER,
                points=25,
                daily_limit=5,
                description="帮助其他用户"
            ),
            PointsActionType.SHARE_CONTENT: PointsRule(
                action_type=PointsActionType.SHARE_CONTENT,
                points=5,
                daily_limit=3,
                description="分享内容"
            ),
            PointsActionType.WRITE_REVIEW: PointsRule(
                action_type=PointsActionType.WRITE_REVIEW,
                points=50,
                daily_limit=1,
                description="撰写课程评价"
            ),
            PointsActionType.INVITE_FRIEND: PointsRule(
                action_type=PointsActionType.INVITE_FRIEND,
                points=100,
                description="邀请好友注册"
            ),
            PointsActionType.COMPLETE_CHALLENGE: PointsRule(
                action_type=PointsActionType.COMPLETE_CHALLENGE,
                points=100,
                description="完成挑战任务"
            )
        }
        
        # 初始化徽章系统
        self._initialize_badges()
    
    def _initialize_badges(self):
        """初始化徽章系统"""
        badges_data = [
            {
                "badge_id": "first_login",
                "name": "初来乍到",
                "description": "首次登录平台",
                "icon": "user-plus",
                "rarity": "common",
                "unlock_condition": "首次登录",
                "points_value": 10
            },
            {
                "badge_id": "week_streak",
                "name": "坚持一周",
                "description": "连续登录7天",
                "icon": "calendar",
                "rarity": "rare",
                "unlock_condition": "连续登录7天",
                "points_value": 50
            },
            {
                "badge_id": "month_streak",
                "name": "月度达人",
                "description": "连续登录30天",
                "icon": "award",
                "rarity": "epic",
                "unlock_condition": "连续登录30天",
                "points_value": 200
            },
            {
                "badge_id": "ai_tutor_master",
                "name": "AI导师专家",
                "description": "完成50次AI导师会话",
                "icon": "brain",
                "rarity": "epic",
                "unlock_condition": "完成50次AI导师会话",
                "points_value": 300
            },
            {
                "badge_id": "helper",
                "name": "乐于助人",
                "description": "帮助其他用户100次",
                "icon": "heart",
                "rarity": "rare",
                "unlock_condition": "帮助其他用户100次",
                "points_value": 150
            },
            {
                "badge_id": "polyglot",
                "name": "语言大师",
                "description": "学习5种不同语言",
                "icon": "globe",
                "rarity": "legendary",
                "unlock_condition": "学习5种不同语言",
                "points_value": 500
            },
            {
                "badge_id": "social_butterfly",
                "name": "社交达人",
                "description": "参与聊天1000次",
                "icon": "message-circle",
                "rarity": "epic",
                "unlock_condition": "参与聊天1000次",
                "points_value": 250
            },
            {
                "badge_id": "knowledge_seeker",
                "name": "求知若渴",
                "description": "完成100个课程",
                "icon": "book",
                "rarity": "rare",
                "unlock_condition": "完成100个课程",
                "points_value": 200
            }
        ]
        
        for badge_data in badges_data:
            badge = Badge(**badge_data)
            self.badges[badge.badge_id] = badge
    
    def get_user_points(self, user_id: str) -> UserPoints:
        """获取用户积分信息"""
        if user_id not in self.user_points:
            self.user_points[user_id] = UserPoints(
                user_id=user_id,
                total_points=0,
                available_points=0,
                level=1,
                current_streak=0,
                longest_streak=0,
                last_activity_date="",
                badges=[]
            )
        return self.user_points[user_id]
    
    def award_points(self, user_id: str, action_type: PointsActionType, 
                    metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """奖励积分"""
        if metadata is None:
            metadata = {}
        
        rule = self.points_rules.get(action_type)
        if not rule:
            raise ValueError(f"Unknown action type: {action_type}")
        
        user_points = self.get_user_points(user_id)
        today = datetime.now().date().isoformat()
        
        # 检查每日限制
        if rule.daily_limit:
            daily_count = self._get_daily_action_count(user_id, action_type, today)
            if daily_count >= rule.daily_limit:
                return {
                    "success": False,
                    "message": f"今日{rule.description}次数已达上限",
                    "points_awarded": 0
                }
        
        # 计算积分（包括倍数奖励）
        base_points = rule.points
        multiplier = 1.0
        
        # 连续登录奖励倍数
        if action_type == PointsActionType.DAILY_LOGIN and rule.multiplier_conditions:
            if user_points.current_streak >= 30 and "streak_30" in rule.multiplier_conditions:
                multiplier = rule.multiplier_conditions["streak_30"]
            elif user_points.current_streak >= 7 and "streak_7" in rule.multiplier_conditions:
                multiplier = rule.multiplier_conditions["streak_7"]
        
        points_awarded = int(base_points * multiplier)
        
        # 更新用户积分
        user_points.total_points += points_awarded
        user_points.available_points += points_awarded
        
        # 更新连续登录
        if action_type == PointsActionType.DAILY_LOGIN:
            self._update_login_streak(user_id, today)
        
        # 更新等级
        new_level = self._calculate_level(user_points.total_points)
        level_up = new_level > user_points.level
        user_points.level = new_level
        
        # 记录交易
        transaction = PointsTransaction(
            transaction_id=str(uuid.uuid4()),
            user_id=user_id,
            action_type=action_type,
            points_change=points_awarded,
            description=rule.description,
            timestamp=datetime.now(),
            metadata=metadata
        )
        self.transactions[transaction.transaction_id] = transaction
        
        # 记录每日活动
        self._record_daily_activity(user_id, action_type, today)
        
        # 检查徽章解锁
        new_badges = self._check_badge_unlocks(user_id)
        
        return {
            "success": True,
            "points_awarded": points_awarded,
            "total_points": user_points.total_points,
            "available_points": user_points.available_points,
            "level": user_points.level,
            "level_up": level_up,
            "multiplier": multiplier,
            "new_badges": new_badges,
            "message": f"获得 {points_awarded} 积分！"
        }
    
    def _get_daily_action_count(self, user_id: str, action_type: PointsActionType, date: str) -> int:
        """获取用户当日某行为的次数"""
        if user_id not in self.daily_activities:
            return 0
        
        user_activities = self.daily_activities[user_id]
        if date not in user_activities:
            return 0
        
        return user_activities[date].get(action_type.value, 0)
    
    def _record_daily_activity(self, user_id: str, action_type: PointsActionType, date: str):
        """记录每日活动"""
        if user_id not in self.daily_activities:
            self.daily_activities[user_id] = {}
        
        if date not in self.daily_activities[user_id]:
            self.daily_activities[user_id][date] = {}
        
        current_count = self.daily_activities[user_id][date].get(action_type.value, 0)
        self.daily_activities[user_id][date][action_type.value] = current_count + 1
    
    def _update_login_streak(self, user_id: str, today: str):
        """更新连续登录记录"""
        user_points = self.get_user_points(user_id)
        
        if not user_points.last_activity_date:
            # 首次登录
            user_points.current_streak = 1
            user_points.longest_streak = 1
        else:
            last_date = datetime.fromisoformat(user_points.last_activity_date).date()
            today_date = datetime.fromisoformat(today).date()
            
            if (today_date - last_date).days == 1:
                # 连续登录
                user_points.current_streak += 1
                user_points.longest_streak = max(user_points.longest_streak, user_points.current_streak)
            elif (today_date - last_date).days > 1:
                # 中断了连续登录
                user_points.current_streak = 1
        
        user_points.last_activity_date = today
    
    def _calculate_level(self, total_points: int) -> int:
        """根据总积分计算等级"""
        # 等级计算公式：每1000积分升一级
        return min(total_points // 1000 + 1, 100)  # 最高100级
    
    def _check_badge_unlocks(self, user_id: str) -> List[Dict[str, Any]]:
        """检查徽章解锁"""
        user_points = self.get_user_points(user_id)
        new_badges = []
        
        # 检查各种徽章条件
        badge_checks = {
            "first_login": lambda: user_points.total_points > 0 and "first_login" not in user_points.badges,
            "week_streak": lambda: user_points.current_streak >= 7 and "week_streak" not in user_points.badges,
            "month_streak": lambda: user_points.current_streak >= 30 and "month_streak" not in user_points.badges,
            "ai_tutor_master": lambda: self._count_user_actions(user_id, PointsActionType.AI_TUTOR_SESSION) >= 50 and "ai_tutor_master" not in user_points.badges,
            "helper": lambda: self._count_user_actions(user_id, PointsActionType.HELP_OTHER_USER) >= 100 and "helper" not in user_points.badges,
            "social_butterfly": lambda: self._count_user_actions(user_id, PointsActionType.CHAT_SESSION) >= 1000 and "social_butterfly" not in user_points.badges,
            "knowledge_seeker": lambda: self._count_user_actions(user_id, PointsActionType.COMPLETE_LESSON) >= 100 and "knowledge_seeker" not in user_points.badges
        }
        
        for badge_id, condition in badge_checks.items():
            if condition():
                badge = self.badges[badge_id]
                user_points.badges.append(badge_id)
                user_points.available_points += badge.points_value
                new_badges.append({
                    "badge_id": badge_id,
                    "name": badge.name,
                    "description": badge.description,
                    "icon": badge.icon,
                    "rarity": badge.rarity,
                    "points_value": badge.points_value
                })
        
        return new_badges
    
    def _count_user_actions(self, user_id: str, action_type: PointsActionType) -> int:
        """统计用户某种行为的总次数"""
        count = 0
        for transaction in self.transactions.values():
            if transaction.user_id == user_id and transaction.action_type == action_type:
                count += 1
        return count
    
    def spend_points(self, user_id: str, points: int, description: str) -> Dict[str, Any]:
        """消费积分"""
        user_points = self.get_user_points(user_id)
        
        if user_points.available_points < points:
            return {
                "success": False,
                "message": "积分不足",
                "available_points": user_points.available_points
            }
        
        user_points.available_points -= points
        
        # 记录消费交易
        transaction = PointsTransaction(
            transaction_id=str(uuid.uuid4()),
            user_id=user_id,
            action_type=PointsActionType.DAILY_LOGIN,  # 临时使用，实际应该有消费类型
            points_change=-points,
            description=f"消费积分：{description}",
            timestamp=datetime.now(),
            metadata={"type": "spend", "description": description}
        )
        self.transactions[transaction.transaction_id] = transaction
        
        return {
            "success": True,
            "points_spent": points,
            "remaining_points": user_points.available_points,
            "message": f"成功消费 {points} 积分"
        }
    
    def get_leaderboard(self, period: str = "all_time", limit: int = 50) -> List[Dict[str, Any]]:
        """获取排行榜"""
        # 按总积分排序
        sorted_users = sorted(
            self.user_points.values(),
            key=lambda x: x.total_points,
            reverse=True
        )
        
        leaderboard = []
        for i, user in enumerate(sorted_users[:limit]):
            leaderboard.append({
                "rank": i + 1,
                "user_id": user.user_id,
                "total_points": user.total_points,
                "level": user.level,
                "current_streak": user.current_streak,
                "badges_count": len(user.badges)
            })
        
        return leaderboard
    
    def get_user_statistics(self, user_id: str) -> Dict[str, Any]:
        """获取用户统计数据"""
        user_points = self.get_user_points(user_id)
        
        # 统计各种行为次数
        action_counts = {}
        for action_type in PointsActionType:
            action_counts[action_type.value] = self._count_user_actions(user_id, action_type)
        
        # 获取最近交易
        user_transactions = [
            t for t in self.transactions.values()
            if t.user_id == user_id
        ]
        user_transactions.sort(key=lambda x: x.timestamp, reverse=True)
        
        # 获取用户徽章详情
        user_badge_details = [
            {
                "badge_id": badge_id,
                "name": self.badges[badge_id].name,
                "description": self.badges[badge_id].description,
                "icon": self.badges[badge_id].icon,
                "rarity": self.badges[badge_id].rarity
            }
            for badge_id in user_points.badges
        ]
        
        return {
            "user_points": user_points.__dict__,
            "action_counts": action_counts,
            "recent_transactions": [
                {
                    "transaction_id": t.transaction_id,
                    "action_type": t.action_type.value,
                    "points_change": t.points_change,
                    "description": t.description,
                    "timestamp": t.timestamp.isoformat()
                }
                for t in user_transactions[:20]
            ],
            "badges": user_badge_details,
            "next_level_points": (user_points.level * 1000) - user_points.total_points
        }

# 创建服务实例
points_service = PointsRewardService()

# 创建蓝图
points_bp = Blueprint('points', __name__, url_prefix='/api/points')

@points_bp.route('/user/<user_id>', methods=['GET'])
def get_user_points(user_id):
    """获取用户积分信息"""
    try:
        user_points = points_service.get_user_points(user_id)
        
        return jsonify({
            "success": True,
            "data": user_points.__dict__
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@points_bp.route('/award', methods=['POST'])
def award_points():
    """奖励积分"""
    data = request.get_json()
    
    try:
        user_id = data.get('user_id')
        action_type_str = data.get('action_type')
        metadata = data.get('metadata', {})
        
        if not user_id or not action_type_str:
            return jsonify({
                "success": False,
                "error": "Missing required fields"
            }), 400
        
        action_type = PointsActionType(action_type_str)
        result = points_service.award_points(user_id, action_type, metadata)
        
        return jsonify({
            "success": True,
            "data": result
        })
    
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": "Invalid action type"
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@points_bp.route('/spend', methods=['POST'])
def spend_points():
    """消费积分"""
    data = request.get_json()
    
    try:
        user_id = data.get('user_id')
        points = data.get('points')
        description = data.get('description', '积分消费')
        
        if not user_id or not points:
            return jsonify({
                "success": False,
                "error": "Missing required fields"
            }), 400
        
        result = points_service.spend_points(user_id, points, description)
        
        return jsonify({
            "success": True,
            "data": result
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@points_bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    """获取排行榜"""
    try:
        period = request.args.get('period', 'all_time')
        limit = int(request.args.get('limit', 50))
        
        leaderboard = points_service.get_leaderboard(period, limit)
        
        return jsonify({
            "success": True,
            "data": leaderboard
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@points_bp.route('/statistics/<user_id>', methods=['GET'])
def get_statistics(user_id):
    """获取用户统计数据"""
    try:
        statistics = points_service.get_user_statistics(user_id)
        
        return jsonify({
            "success": True,
            "data": statistics
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@points_bp.route('/badges', methods=['GET'])
def get_all_badges():
    """获取所有徽章"""
    try:
        badges = [
            {
                "badge_id": badge.badge_id,
                "name": badge.name,
                "description": badge.description,
                "icon": badge.icon,
                "rarity": badge.rarity,
                "unlock_condition": badge.unlock_condition,
                "points_value": badge.points_value
            }
            for badge in points_service.badges.values()
        ]
        
        return jsonify({
            "success": True,
            "data": badges
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@points_bp.route('/rules', methods=['GET'])
def get_points_rules():
    """获取积分规则"""
    try:
        rules = [
            {
                "action_type": rule.action_type.value,
                "points": rule.points,
                "daily_limit": rule.daily_limit,
                "description": rule.description
            }
            for rule in points_service.points_rules.values()
        ]
        
        return jsonify({
            "success": True,
            "data": rules
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

