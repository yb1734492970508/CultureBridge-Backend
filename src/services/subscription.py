"""
CultureBridge Premium Subscription Service
高级订阅管理系统
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any
import uuid
from dataclasses import dataclass
from flask import Blueprint, request, jsonify
from werkzeug.exceptions import BadRequest, NotFound, Forbidden

# 订阅计划枚举
class SubscriptionPlan(Enum):
    FREE = "free"
    BASIC = "basic"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"

# 订阅状态枚举
class SubscriptionStatus(Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    PENDING = "pending"

@dataclass
class SubscriptionFeature:
    """订阅功能特性"""
    name: str
    description: str
    enabled: bool
    limit: Optional[int] = None  # None表示无限制

@dataclass
class PlanConfig:
    """订阅计划配置"""
    plan: SubscriptionPlan
    name: str
    description: str
    price_monthly: float
    price_yearly: float
    features: List[SubscriptionFeature]
    max_ai_tutor_hours: int
    max_premium_circles: int
    max_content_downloads: int
    priority_support: bool

# 订阅计划配置
SUBSCRIPTION_PLANS = {
    SubscriptionPlan.FREE: PlanConfig(
        plan=SubscriptionPlan.FREE,
        name="免费版",
        description="基础功能，适合初学者",
        price_monthly=0.0,
        price_yearly=0.0,
        features=[
            SubscriptionFeature("基础翻译", "每日50次翻译", True, 50),
            SubscriptionFeature("社区交流", "参与公开讨论", True),
            SubscriptionFeature("基础课程", "免费课程内容", True),
        ],
        max_ai_tutor_hours=0,
        max_premium_circles=0,
        max_content_downloads=5,
        priority_support=False
    ),
    SubscriptionPlan.BASIC: PlanConfig(
        plan=SubscriptionPlan.BASIC,
        name="基础版",
        description="更多功能，适合日常学习",
        price_monthly=29.0,
        price_yearly=290.0,
        features=[
            SubscriptionFeature("无限翻译", "不限次数翻译", True),
            SubscriptionFeature("AI语音助手", "语音识别和合成", True),
            SubscriptionFeature("进阶课程", "付费课程内容", True),
            SubscriptionFeature("学习报告", "详细进度分析", True),
        ],
        max_ai_tutor_hours=5,
        max_premium_circles=2,
        max_content_downloads=50,
        priority_support=False
    ),
    SubscriptionPlan.PREMIUM: PlanConfig(
        plan=SubscriptionPlan.PREMIUM,
        name="高级版",
        description="全功能体验，适合深度学习",
        price_monthly=99.0,
        price_yearly=990.0,
        features=[
            SubscriptionFeature("AI个人导师", "专属AI语言导师", True),
            SubscriptionFeature("专属交流圈", "高质量社群", True),
            SubscriptionFeature("专家指导", "真人专家答疑", True),
            SubscriptionFeature("无广告体验", "纯净学习环境", True),
            SubscriptionFeature("优先客服", "24小时优先支持", True),
            SubscriptionFeature("线下活动", "专属活动邀请", True),
        ],
        max_ai_tutor_hours=30,
        max_premium_circles=10,
        max_content_downloads=500,
        priority_support=True
    ),
    SubscriptionPlan.ENTERPRISE: PlanConfig(
        plan=SubscriptionPlan.ENTERPRISE,
        name="企业版",
        description="团队协作，适合企业培训",
        price_monthly=299.0,
        price_yearly=2990.0,
        features=[
            SubscriptionFeature("团队管理", "员工学习管理", True),
            SubscriptionFeature("定制课程", "企业专属内容", True),
            SubscriptionFeature("数据分析", "团队学习报告", True),
            SubscriptionFeature("API接入", "系统集成支持", True),
            SubscriptionFeature("专属客服", "企业级技术支持", True),
        ],
        max_ai_tutor_hours=100,
        max_premium_circles=50,
        max_content_downloads=5000,
        priority_support=True
    )
}

class SubscriptionService:
    """订阅服务类"""
    
    def __init__(self):
        # 模拟数据库存储
        self.subscriptions = {}
        self.payment_records = {}
        self.usage_records = {}
    
    def create_subscription(self, user_id: str, plan: SubscriptionPlan, 
                          billing_cycle: str = "monthly") -> Dict[str, Any]:
        """创建订阅"""
        if billing_cycle not in ["monthly", "yearly"]:
            raise BadRequest("Invalid billing cycle")
        
        plan_config = SUBSCRIPTION_PLANS[plan]
        
        # 计算价格和到期时间
        if billing_cycle == "monthly":
            price = plan_config.price_monthly
            expires_at = datetime.now() + timedelta(days=30)
        else:
            price = plan_config.price_yearly
            expires_at = datetime.now() + timedelta(days=365)
        
        subscription_id = str(uuid.uuid4())
        subscription = {
            "id": subscription_id,
            "user_id": user_id,
            "plan": plan.value,
            "status": SubscriptionStatus.ACTIVE.value if plan == SubscriptionPlan.FREE else SubscriptionStatus.PENDING.value,
            "billing_cycle": billing_cycle,
            "price": price,
            "created_at": datetime.now().isoformat(),
            "expires_at": expires_at.isoformat(),
            "auto_renew": True,
            "features": [
                {
                    "name": f.name,
                    "description": f.description,
                    "enabled": f.enabled,
                    "limit": f.limit
                }
                for f in plan_config.features
            ]
        }
        
        self.subscriptions[subscription_id] = subscription
        
        # 初始化使用记录
        self.usage_records[user_id] = {
            "ai_tutor_hours_used": 0,
            "premium_circles_joined": 0,
            "content_downloads": 0,
            "translations_today": 0,
            "last_reset_date": datetime.now().date().isoformat()
        }
        
        return subscription
    
    def get_user_subscription(self, user_id: str) -> Optional[Dict[str, Any]]:
        """获取用户当前订阅"""
        for subscription in self.subscriptions.values():
            if (subscription["user_id"] == user_id and 
                subscription["status"] == SubscriptionStatus.ACTIVE.value):
                return subscription
        return None
    
    def check_feature_access(self, user_id: str, feature_name: str) -> Dict[str, Any]:
        """检查功能访问权限"""
        subscription = self.get_user_subscription(user_id)
        if not subscription:
            # 默认免费计划
            subscription = self.create_subscription(user_id, SubscriptionPlan.FREE)
        
        plan = SubscriptionPlan(subscription["plan"])
        plan_config = SUBSCRIPTION_PLANS[plan]
        usage = self.usage_records.get(user_id, {})
        
        # 检查具体功能限制
        access_info = {
            "has_access": False,
            "remaining_quota": 0,
            "upgrade_required": False,
            "message": ""
        }
        
        if feature_name == "ai_tutor":
            max_hours = plan_config.max_ai_tutor_hours
            used_hours = usage.get("ai_tutor_hours_used", 0)
            
            if max_hours == 0:
                access_info.update({
                    "has_access": False,
                    "upgrade_required": True,
                    "message": "AI导师功能需要升级到基础版或更高版本"
                })
            elif used_hours < max_hours:
                access_info.update({
                    "has_access": True,
                    "remaining_quota": max_hours - used_hours,
                    "message": f"本月还可使用 {max_hours - used_hours} 小时"
                })
            else:
                access_info.update({
                    "has_access": False,
                    "upgrade_required": True,
                    "message": "本月AI导师时长已用完，请升级套餐或等待下月重置"
                })
        
        elif feature_name == "premium_circles":
            max_circles = plan_config.max_premium_circles
            joined_circles = usage.get("premium_circles_joined", 0)
            
            if max_circles == 0:
                access_info.update({
                    "has_access": False,
                    "upgrade_required": True,
                    "message": "专属交流圈需要升级到基础版或更高版本"
                })
            elif joined_circles < max_circles:
                access_info.update({
                    "has_access": True,
                    "remaining_quota": max_circles - joined_circles,
                    "message": f"还可加入 {max_circles - joined_circles} 个专属交流圈"
                })
            else:
                access_info.update({
                    "has_access": False,
                    "upgrade_required": True,
                    "message": "已达到专属交流圈数量上限，请升级套餐"
                })
        
        elif feature_name == "translation":
            # 检查每日翻译限制（仅免费用户）
            if plan == SubscriptionPlan.FREE:
                today_translations = usage.get("translations_today", 0)
                daily_limit = 50
                
                if today_translations < daily_limit:
                    access_info.update({
                        "has_access": True,
                        "remaining_quota": daily_limit - today_translations,
                        "message": f"今日还可翻译 {daily_limit - today_translations} 次"
                    })
                else:
                    access_info.update({
                        "has_access": False,
                        "upgrade_required": True,
                        "message": "今日翻译次数已用完，请升级获得无限翻译"
                    })
            else:
                access_info.update({
                    "has_access": True,
                    "remaining_quota": -1,  # 无限制
                    "message": "无限翻译"
                })
        
        return access_info
    
    def record_feature_usage(self, user_id: str, feature_name: str, amount: int = 1):
        """记录功能使用"""
        if user_id not in self.usage_records:
            self.usage_records[user_id] = {
                "ai_tutor_hours_used": 0,
                "premium_circles_joined": 0,
                "content_downloads": 0,
                "translations_today": 0,
                "last_reset_date": datetime.now().date().isoformat()
            }
        
        usage = self.usage_records[user_id]
        
        # 检查是否需要重置每日计数
        today = datetime.now().date().isoformat()
        if usage["last_reset_date"] != today:
            usage["translations_today"] = 0
            usage["last_reset_date"] = today
        
        # 记录使用
        if feature_name == "ai_tutor":
            usage["ai_tutor_hours_used"] += amount
        elif feature_name == "premium_circles":
            usage["premium_circles_joined"] += amount
        elif feature_name == "content_downloads":
            usage["content_downloads"] += amount
        elif feature_name == "translation":
            usage["translations_today"] += amount
    
    def upgrade_subscription(self, user_id: str, new_plan: SubscriptionPlan, 
                           billing_cycle: str = "monthly") -> Dict[str, Any]:
        """升级订阅"""
        current_subscription = self.get_user_subscription(user_id)
        
        if current_subscription:
            # 取消当前订阅
            current_subscription["status"] = SubscriptionStatus.CANCELLED.value
        
        # 创建新订阅
        return self.create_subscription(user_id, new_plan, billing_cycle)
    
    def get_subscription_analytics(self, user_id: str) -> Dict[str, Any]:
        """获取订阅分析数据"""
        subscription = self.get_user_subscription(user_id)
        usage = self.usage_records.get(user_id, {})
        
        if not subscription:
            return {"error": "No active subscription found"}
        
        plan = SubscriptionPlan(subscription["plan"])
        plan_config = SUBSCRIPTION_PLANS[plan]
        
        return {
            "subscription": subscription,
            "usage": usage,
            "limits": {
                "ai_tutor_hours": plan_config.max_ai_tutor_hours,
                "premium_circles": plan_config.max_premium_circles,
                "content_downloads": plan_config.max_content_downloads
            },
            "utilization": {
                "ai_tutor": (usage.get("ai_tutor_hours_used", 0) / max(plan_config.max_ai_tutor_hours, 1)) * 100 if plan_config.max_ai_tutor_hours > 0 else 0,
                "premium_circles": (usage.get("premium_circles_joined", 0) / max(plan_config.max_premium_circles, 1)) * 100 if plan_config.max_premium_circles > 0 else 0,
                "content_downloads": (usage.get("content_downloads", 0) / max(plan_config.max_content_downloads, 1)) * 100
            }
        }

# 创建服务实例
subscription_service = SubscriptionService()

# 创建蓝图
subscription_bp = Blueprint('subscription', __name__, url_prefix='/api/subscription')

@subscription_bp.route('/plans', methods=['GET'])
def get_subscription_plans():
    """获取所有订阅计划"""
    plans = []
    for plan_enum, config in SUBSCRIPTION_PLANS.items():
        plans.append({
            "plan": plan_enum.value,
            "name": config.name,
            "description": config.description,
            "price_monthly": config.price_monthly,
            "price_yearly": config.price_yearly,
            "features": [
                {
                    "name": f.name,
                    "description": f.description,
                    "enabled": f.enabled,
                    "limit": f.limit
                }
                for f in config.features
            ],
            "limits": {
                "ai_tutor_hours": config.max_ai_tutor_hours,
                "premium_circles": config.max_premium_circles,
                "content_downloads": config.max_content_downloads,
                "priority_support": config.priority_support
            }
        })
    
    return jsonify({
        "success": True,
        "data": plans
    })

@subscription_bp.route('/subscribe', methods=['POST'])
def create_subscription():
    """创建订阅"""
    data = request.get_json()
    
    try:
        user_id = data.get('user_id')
        plan_str = data.get('plan')
        billing_cycle = data.get('billing_cycle', 'monthly')
        
        if not user_id or not plan_str:
            raise BadRequest("Missing required fields")
        
        plan = SubscriptionPlan(plan_str)
        subscription = subscription_service.create_subscription(user_id, plan, billing_cycle)
        
        return jsonify({
            "success": True,
            "data": subscription,
            "message": "订阅创建成功"
        })
    
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": "Invalid subscription plan"
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@subscription_bp.route('/user/<user_id>', methods=['GET'])
def get_user_subscription(user_id):
    """获取用户订阅信息"""
    try:
        subscription = subscription_service.get_user_subscription(user_id)
        
        if not subscription:
            # 返回默认免费计划信息
            free_plan = SUBSCRIPTION_PLANS[SubscriptionPlan.FREE]
            return jsonify({
                "success": True,
                "data": {
                    "plan": SubscriptionPlan.FREE.value,
                    "status": "active",
                    "features": [
                        {
                            "name": f.name,
                            "description": f.description,
                            "enabled": f.enabled,
                            "limit": f.limit
                        }
                        for f in free_plan.features
                    ]
                }
            })
        
        return jsonify({
            "success": True,
            "data": subscription
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@subscription_bp.route('/check-access', methods=['POST'])
def check_feature_access():
    """检查功能访问权限"""
    data = request.get_json()
    
    try:
        user_id = data.get('user_id')
        feature_name = data.get('feature')
        
        if not user_id or not feature_name:
            raise BadRequest("Missing required fields")
        
        access_info = subscription_service.check_feature_access(user_id, feature_name)
        
        return jsonify({
            "success": True,
            "data": access_info
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@subscription_bp.route('/record-usage', methods=['POST'])
def record_usage():
    """记录功能使用"""
    data = request.get_json()
    
    try:
        user_id = data.get('user_id')
        feature_name = data.get('feature')
        amount = data.get('amount', 1)
        
        if not user_id or not feature_name:
            raise BadRequest("Missing required fields")
        
        subscription_service.record_feature_usage(user_id, feature_name, amount)
        
        return jsonify({
            "success": True,
            "message": "使用记录已更新"
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@subscription_bp.route('/upgrade', methods=['POST'])
def upgrade_subscription():
    """升级订阅"""
    data = request.get_json()
    
    try:
        user_id = data.get('user_id')
        new_plan_str = data.get('new_plan')
        billing_cycle = data.get('billing_cycle', 'monthly')
        
        if not user_id or not new_plan_str:
            raise BadRequest("Missing required fields")
        
        new_plan = SubscriptionPlan(new_plan_str)
        subscription = subscription_service.upgrade_subscription(user_id, new_plan, billing_cycle)
        
        return jsonify({
            "success": True,
            "data": subscription,
            "message": "订阅升级成功"
        })
    
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": "Invalid subscription plan"
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@subscription_bp.route('/analytics/<user_id>', methods=['GET'])
def get_analytics(user_id):
    """获取订阅分析数据"""
    try:
        analytics = subscription_service.get_subscription_analytics(user_id)
        
        return jsonify({
            "success": True,
            "data": analytics
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

