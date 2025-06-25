"""
CultureBridge AI Personal Tutor Service
AI个人导师服务 - 简化版
"""

import uuid
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
from flask import Blueprint, request, jsonify

# 移除openai导入，使用模拟响应

class TutorSessionType(Enum):
    CONVERSATION = "conversation"
    GRAMMAR_CHECK = "grammar_check"
    PRONUNCIATION = "pronunciation"
    CULTURAL_INSIGHT = "cultural_insight"
    WRITING_ASSISTANCE = "writing_assistance"

class LanguageLevel(Enum):
    BEGINNER = "beginner"
    ELEMENTARY = "elementary"
    INTERMEDIATE = "intermediate"
    UPPER_INTERMEDIATE = "upper_intermediate"
    ADVANCED = "advanced"
    PROFICIENT = "proficient"

@dataclass
class UserProfile:
    """用户学习档案"""
    user_id: str
    native_language: str
    target_languages: List[str]
    current_level: Dict[str, LanguageLevel]
    learning_goals: List[str]
    interests: List[str]
    learning_style: str  # visual, auditory, kinesthetic, reading
    weak_areas: List[str]
    strong_areas: List[str]
    preferred_topics: List[str]

@dataclass
class TutorSession:
    """导师会话记录"""
    session_id: str
    user_id: str
    session_type: TutorSessionType
    target_language: str
    duration_minutes: int
    started_at: datetime
    ended_at: Optional[datetime]
    messages: List[Dict[str, Any]]
    feedback: Optional[Dict[str, Any]]
    homework: Optional[Dict[str, Any]]

class AITutorService:
    """AI导师服务类"""
    
    def __init__(self):
        # 模拟数据存储
        self.user_profiles = {}
        self.sessions = {}
        self.learning_progress = {}
        
        # AI提示词模板
        self.system_prompts = {
            TutorSessionType.CONVERSATION: """
你是一位专业的语言导师，专门帮助用户练习{target_language}对话。
用户的母语是{native_language}，当前水平是{level}。
用户的学习目标：{goals}
用户的兴趣爱好：{interests}

请以友好、耐心的方式与用户对话，根据用户水平调整语言难度。
在对话中自然地纠正错误，提供更好的表达方式，并解释文化背景。
每次回复后，提供一个简短的学习要点。
""",
            TutorSessionType.GRAMMAR_CHECK: """
你是一位语法专家，专门帮助用户检查和改进{target_language}语法。
用户的母语是{native_language}，当前水平是{level}。

请仔细检查用户的文本，指出语法错误，提供正确的表达方式，并解释语法规则。
用简单易懂的方式解释，避免过于复杂的语法术语。
""",
            TutorSessionType.CULTURAL_INSIGHT: """
你是一位文化专家，专门帮助用户了解{target_language}相关的文化知识。
用户的母语是{native_language}，当前水平是{level}。

请提供有趣、实用的文化洞察，包括：
- 社交礼仪和习俗
- 日常生活文化
- 商务文化
- 节日传统
- 语言中的文化内涵

用生动的例子和故事来解释文化差异。
"""
        }
    
    def create_user_profile(self, user_data: Dict[str, Any]) -> UserProfile:
        """创建用户学习档案"""
        profile = UserProfile(
            user_id=user_data['user_id'],
            native_language=user_data['native_language'],
            target_languages=user_data['target_languages'],
            current_level={lang: LanguageLevel(level) for lang, level in user_data['current_level'].items()},
            learning_goals=user_data.get('learning_goals', []),
            interests=user_data.get('interests', []),
            learning_style=user_data.get('learning_style', 'mixed'),
            weak_areas=user_data.get('weak_areas', []),
            strong_areas=user_data.get('strong_areas', []),
            preferred_topics=user_data.get('preferred_topics', [])
        )
        
        self.user_profiles[user_data['user_id']] = profile
        return profile
    
    def get_user_profile(self, user_id: str) -> Optional[UserProfile]:
        """获取用户档案"""
        return self.user_profiles.get(user_id)
    
    def start_tutor_session(self, user_id: str, session_type: TutorSessionType, 
                           target_language: str) -> TutorSession:
        """开始导师会话"""
        session_id = str(uuid.uuid4())
        
        session = TutorSession(
            session_id=session_id,
            user_id=user_id,
            session_type=session_type,
            target_language=target_language,
            duration_minutes=0,
            started_at=datetime.now(),
            ended_at=None,
            messages=[],
            feedback=None,
            homework=None
        )
        
        self.sessions[session_id] = session
        
        # 生成欢迎消息
        welcome_message = self._generate_welcome_message(user_id, session_type, target_language)
        session.messages.append({
            "role": "assistant",
            "content": welcome_message,
            "timestamp": datetime.now().isoformat(),
            "type": "welcome"
        })
        
        return session
    
    def _generate_welcome_message(self, user_id: str, session_type: TutorSessionType, 
                                 target_language: str) -> str:
        """生成欢迎消息"""
        profile = self.get_user_profile(user_id)
        
        if session_type == TutorSessionType.CONVERSATION:
            if profile and profile.preferred_topics:
                topic = profile.preferred_topics[0]
                return f"你好！我是你的{target_language}对话导师。今天我们来聊聊{topic}吧！请用{target_language}告诉我你对这个话题的看法。"
            else:
                return f"你好！我是你的{target_language}对话导师。今天你想聊什么话题呢？请用{target_language}开始我们的对话。"
        
        elif session_type == TutorSessionType.GRAMMAR_CHECK:
            return f"你好！我是你的{target_language}语法导师。请发送你想要检查的文本，我会帮你找出语法错误并提供改进建议。"
        
        elif session_type == TutorSessionType.CULTURAL_INSIGHT:
            return f"你好！我是你的{target_language}文化导师。今天你想了解哪个方面的文化知识呢？比如节日传统、社交礼仪、商务文化等。"
        
        else:
            return f"你好！我是你的{target_language}学习导师。我会根据你的需要提供个性化的指导。有什么可以帮助你的吗？"
    
    def process_user_message(self, session_id: str, user_message: str) -> Dict[str, Any]:
        """处理用户消息"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError("Session not found")
        
        # 记录用户消息
        session.messages.append({
            "role": "user",
            "content": user_message,
            "timestamp": datetime.now().isoformat(),
            "type": "message"
        })
        
        # 生成AI回复
        ai_response = self._generate_ai_response(session, user_message)
        
        # 记录AI回复
        session.messages.append({
            "role": "assistant",
            "content": ai_response["content"],
            "timestamp": datetime.now().isoformat(),
            "type": "response",
            "corrections": ai_response.get("corrections", []),
            "suggestions": ai_response.get("suggestions", []),
            "cultural_notes": ai_response.get("cultural_notes", [])
        })
        
        return ai_response
    
    def _generate_ai_response(self, session: TutorSession, user_message: str) -> Dict[str, Any]:
        """生成AI回复"""
        profile = self.get_user_profile(session.user_id)
        
        # 构建系统提示词
        if session.session_type in self.system_prompts:
            system_prompt = self.system_prompts[session.session_type].format(
                target_language=session.target_language,
                native_language=profile.native_language if profile else "中文",
                level=profile.current_level.get(session.target_language, LanguageLevel.INTERMEDIATE).value if profile else "intermediate",
                goals=", ".join(profile.learning_goals) if profile and profile.learning_goals else "提高语言水平",
                interests=", ".join(profile.interests) if profile and profile.interests else "日常生活"
            )
        else:
            system_prompt = f"你是一位专业的{session.target_language}导师。"
        
        # 模拟AI回复（实际应用中会调用OpenAI API）
        if session.session_type == TutorSessionType.CONVERSATION:
            response = self._simulate_conversation_response(user_message, session.target_language)
        elif session.session_type == TutorSessionType.GRAMMAR_CHECK:
            response = self._simulate_grammar_check_response(user_message, session.target_language)
        elif session.session_type == TutorSessionType.CULTURAL_INSIGHT:
            response = self._simulate_cultural_response(user_message, session.target_language)
        else:
            response = {
                "content": f"感谢你的消息：'{user_message}'。我会根据你的需要提供帮助。",
                "corrections": [],
                "suggestions": [],
                "cultural_notes": []
            }
        
        return response
    
    def _simulate_conversation_response(self, user_message: str, target_language: str) -> Dict[str, Any]:
        """模拟对话回复"""
        corrections = []
        suggestions = []
        cultural_notes = []
        
        # 简单的错误检测和建议（实际应用中会使用更复杂的NLP）
        if "how are you" in user_message.lower():
            suggestions.append({
                "original": "how are you",
                "suggestion": "How are you doing today?",
                "explanation": "添加'today'使对话更自然"
            })
        
        if target_language.lower() == "english":
            content = f"Thank you for sharing that! I understand you said: '{user_message}'. Let me respond and help you improve your English. "
            if corrections:
                content += "I noticed a few areas where we can improve your expression. "
            content += "Keep practicing - you're doing great!"
            
            cultural_notes.append({
                "note": "在英语对话中，积极的反馈和鼓励是很常见的",
                "context": "社交文化"
            })
        
        elif target_language.lower() == "japanese":
            content = f"ありがとうございます！あなたのメッセージ「{user_message}」を理解しました。日本語の練習を続けましょう！"
            cultural_notes.append({
                "note": "日本語では丁寧語を使うことが重要です",
                "context": "言語文化"
            })
        
        else:
            content = f"很好！我理解你说的：'{user_message}'。让我们继续练习{target_language}吧！"
        
        return {
            "content": content,
            "corrections": corrections,
            "suggestions": suggestions,
            "cultural_notes": cultural_notes
        }
    
    def _simulate_grammar_check_response(self, user_message: str, target_language: str) -> Dict[str, Any]:
        """模拟语法检查回复"""
        corrections = []
        
        # 简单的语法错误检测
        if "i am go" in user_message.lower():
            corrections.append({
                "original": "i am go",
                "corrected": "I am going",
                "error_type": "动词时态",
                "explanation": "应该使用现在进行时 'am going' 而不是 'am go'"
            })
        
        if "he don't" in user_message.lower():
            corrections.append({
                "original": "he don't",
                "corrected": "he doesn't",
                "error_type": "主谓一致",
                "explanation": "第三人称单数应该使用 'doesn't' 而不是 'don't'"
            })
        
        if corrections:
            content = f"我检查了你的文本：'{user_message}'，发现了一些可以改进的地方。"
        else:
            content = f"很好！你的文本：'{user_message}' 语法基本正确。"
        
        return {
            "content": content,
            "corrections": corrections,
            "suggestions": [],
            "cultural_notes": []
        }
    
    def _simulate_cultural_response(self, user_message: str, target_language: str) -> Dict[str, Any]:
        """模拟文化洞察回复"""
        cultural_notes = []
        
        if "greeting" in user_message.lower() or "hello" in user_message.lower():
            if target_language.lower() == "english":
                cultural_notes.append({
                    "note": "在英语国家，握手是最常见的正式问候方式",
                    "context": "社交礼仪"
                })
                cultural_notes.append({
                    "note": "美国人通常保持约1.5米的社交距离",
                    "context": "个人空间"
                })
            elif target_language.lower() == "japanese":
                cultural_notes.append({
                    "note": "在日本，鞠躬是传统的问候方式，角度表示尊敬程度",
                    "context": "传统礼仪"
                })
        
        content = f"关于'{user_message}'，让我为你介绍一些{target_language}文化背景。"
        
        return {
            "content": content,
            "corrections": [],
            "suggestions": [],
            "cultural_notes": cultural_notes
        }
    
    def end_session(self, session_id: str) -> Dict[str, Any]:
        """结束会话"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError("Session not found")
        
        session.ended_at = datetime.now()
        session.duration_minutes = int((session.ended_at - session.started_at).total_seconds() / 60)
        
        # 生成会话总结和反馈
        feedback = self._generate_session_feedback(session)
        session.feedback = feedback
        
        # 生成作业建议
        homework = self._generate_homework(session)
        session.homework = homework
        
        # 更新学习进度
        self._update_learning_progress(session)
        
        return {
            "session_summary": {
                "duration_minutes": session.duration_minutes,
                "message_count": len([msg for msg in session.messages if msg["role"] == "user"]),
                "session_type": session.session_type.value
            },
            "feedback": feedback,
            "homework": homework
        }
    
    def _generate_session_feedback(self, session: TutorSession) -> Dict[str, Any]:
        """生成会话反馈"""
        user_messages = [msg for msg in session.messages if msg["role"] == "user"]
        
        return {
            "overall_performance": "良好",
            "strengths": [
                "积极参与对话",
                "勇于尝试新表达"
            ],
            "areas_for_improvement": [
                "注意语法准确性",
                "扩大词汇量"
            ],
            "progress_score": 85,
            "next_session_recommendations": [
                "继续练习日常对话",
                "重点关注动词时态"
            ]
        }
    
    def _generate_homework(self, session: TutorSession) -> Dict[str, Any]:
        """生成作业建议"""
        if session.session_type == TutorSessionType.CONVERSATION:
            return {
                "type": "conversation_practice",
                "title": "日常对话练习",
                "tasks": [
                    {
                        "task": "录制一段2分钟的自我介绍",
                        "description": "用目标语言介绍你的兴趣爱好",
                        "estimated_time": "15分钟"
                    },
                    {
                        "task": "学习5个新词汇",
                        "description": "从今天的对话中选择5个新词汇，造句练习",
                        "estimated_time": "20分钟"
                    }
                ],
                "due_date": (datetime.now() + timedelta(days=3)).isoformat()
            }
        
        elif session.session_type == TutorSessionType.GRAMMAR_CHECK:
            return {
                "type": "grammar_practice",
                "title": "语法强化练习",
                "tasks": [
                    {
                        "task": "完成时态练习题",
                        "description": "重点练习今天讨论的语法点",
                        "estimated_time": "30分钟"
                    }
                ],
                "due_date": (datetime.now() + timedelta(days=2)).isoformat()
            }
        
        else:
            return {
                "type": "general_practice",
                "title": "综合练习",
                "tasks": [
                    {
                        "task": "复习今天的学习内容",
                        "description": "整理笔记，巩固知识点",
                        "estimated_time": "15分钟"
                    }
                ],
                "due_date": (datetime.now() + timedelta(days=1)).isoformat()
            }
    
    def _update_learning_progress(self, session: TutorSession):
        """更新学习进度"""
        user_id = session.user_id
        
        if user_id not in self.learning_progress:
            self.learning_progress[user_id] = {
                "total_sessions": 0,
                "total_hours": 0,
                "languages": {},
                "skill_scores": {
                    "speaking": 0,
                    "listening": 0,
                    "reading": 0,
                    "writing": 0,
                    "grammar": 0,
                    "vocabulary": 0
                }
            }
        
        progress = self.learning_progress[user_id]
        progress["total_sessions"] += 1
        progress["total_hours"] += session.duration_minutes / 60
        
        # 更新语言特定进度
        lang = session.target_language
        if lang not in progress["languages"]:
            progress["languages"][lang] = {
                "sessions": 0,
                "hours": 0,
                "level_progress": 0
            }
        
        progress["languages"][lang]["sessions"] += 1
        progress["languages"][lang]["hours"] += session.duration_minutes / 60
        progress["languages"][lang]["level_progress"] += 2  # 每次会话增加2点经验
    
    def get_learning_analytics(self, user_id: str) -> Dict[str, Any]:
        """获取学习分析数据"""
        progress = self.learning_progress.get(user_id, {})
        profile = self.get_user_profile(user_id)
        
        # 获取最近的会话
        recent_sessions = [
            session for session in self.sessions.values()
            if session.user_id == user_id and session.ended_at
        ]
        recent_sessions.sort(key=lambda x: x.ended_at, reverse=True)
        
        return {
            "profile": profile.__dict__ if profile else None,
            "progress": progress,
            "recent_sessions": [
                {
                    "session_id": session.session_id,
                    "type": session.session_type.value,
                    "language": session.target_language,
                    "duration": session.duration_minutes,
                    "date": session.started_at.isoformat(),
                    "feedback_score": session.feedback.get("progress_score", 0) if session.feedback else 0
                }
                for session in recent_sessions[:10]
            ],
            "recommendations": self._generate_learning_recommendations(user_id)
        }
    
    def _generate_learning_recommendations(self, user_id: str) -> List[str]:
        """生成学习建议"""
        progress = self.learning_progress.get(user_id, {})
        
        recommendations = []
        
        if progress.get("total_sessions", 0) < 5:
            recommendations.append("建议每周至少进行2-3次AI导师会话")
        
        if progress.get("total_hours", 0) < 10:
            recommendations.append("增加学习时间，每次会话建议30分钟以上")
        
        recommendations.append("尝试不同类型的会话，全面提升语言技能")
        recommendations.append("定期复习之前的学习内容，巩固知识点")
        
        return recommendations

# 创建服务实例
ai_tutor_service = AITutorService()

# 创建蓝图
ai_tutor_bp = Blueprint('ai_tutor', __name__, url_prefix='/api/ai-tutor')

@ai_tutor_bp.route('/profile', methods=['POST'])
def create_profile():
    """创建用户学习档案"""
    data = request.get_json()
    
    try:
        profile = ai_tutor_service.create_user_profile(data)
        
        return jsonify({
            "success": True,
            "data": profile.__dict__,
            "message": "学习档案创建成功"
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@ai_tutor_bp.route('/profile/<user_id>', methods=['GET'])
def get_profile(user_id):
    """获取用户学习档案"""
    try:
        profile = ai_tutor_service.get_user_profile(user_id)
        
        if not profile:
            return jsonify({
                "success": False,
                "error": "Profile not found"
            }), 404
        
        return jsonify({
            "success": True,
            "data": profile.__dict__
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@ai_tutor_bp.route('/session/start', methods=['POST'])
def start_session():
    """开始导师会话"""
    data = request.get_json()
    
    try:
        user_id = data.get('user_id')
        session_type_str = data.get('session_type')
        target_language = data.get('target_language')
        
        if not all([user_id, session_type_str, target_language]):
            return jsonify({
                "success": False,
                "error": "Missing required fields"
            }), 400
        
        session_type = TutorSessionType(session_type_str)
        session = ai_tutor_service.start_tutor_session(user_id, session_type, target_language)
        
        return jsonify({
            "success": True,
            "data": {
                "session_id": session.session_id,
                "session_type": session.session_type.value,
                "target_language": session.target_language,
                "welcome_message": session.messages[0]["content"] if session.messages else ""
            },
            "message": "会话已开始"
        })
    
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": "Invalid session type"
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@ai_tutor_bp.route('/session/<session_id>/message', methods=['POST'])
def send_message(session_id):
    """发送消息到会话"""
    data = request.get_json()
    
    try:
        user_message = data.get('message')
        
        if not user_message:
            return jsonify({
                "success": False,
                "error": "Message is required"
            }), 400
        
        response = ai_tutor_service.process_user_message(session_id, user_message)
        
        return jsonify({
            "success": True,
            "data": response
        })
    
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 404
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@ai_tutor_bp.route('/session/<session_id>/end', methods=['POST'])
def end_session(session_id):
    """结束会话"""
    try:
        result = ai_tutor_service.end_session(session_id)
        
        return jsonify({
            "success": True,
            "data": result,
            "message": "会话已结束"
        })
    
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 404
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@ai_tutor_bp.route('/analytics/<user_id>', methods=['GET'])
def get_analytics(user_id):
    """获取学习分析数据"""
    try:
        analytics = ai_tutor_service.get_learning_analytics(user_id)
        
        return jsonify({
            "success": True,
            "data": analytics
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@ai_tutor_bp.route('/session-types', methods=['GET'])
def get_session_types():
    """获取可用的会话类型"""
    session_types = [
        {
            "type": TutorSessionType.CONVERSATION.value,
            "name": "对话练习",
            "description": "与AI导师进行自然对话，提升口语表达能力",
            "icon": "message-circle",
            "estimated_duration": "20-30分钟"
        },
        {
            "type": TutorSessionType.GRAMMAR_CHECK.value,
            "name": "语法检查",
            "description": "检查文本语法错误，获得详细的改进建议",
            "icon": "check-circle",
            "estimated_duration": "10-15分钟"
        },
        {
            "type": TutorSessionType.PRONUNCIATION.value,
            "name": "发音练习",
            "description": "练习发音，获得实时反馈和纠正",
            "icon": "mic",
            "estimated_duration": "15-25分钟"
        },
        {
            "type": TutorSessionType.CULTURAL_INSIGHT.value,
            "name": "文化洞察",
            "description": "了解语言背后的文化内涵和社交习俗",
            "icon": "globe",
            "estimated_duration": "15-20分钟"
        },
        {
            "type": TutorSessionType.WRITING_ASSISTANCE.value,
            "name": "写作辅导",
            "description": "提升写作技巧，获得结构和表达建议",
            "icon": "edit",
            "estimated_duration": "25-35分钟"
        }
    ]
    
    return jsonify({
        "success": True,
        "data": session_types
    })

