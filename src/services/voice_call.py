"""
CultureBridge Backend Voice Call Matching Service
跨国语音通话匹配服务，支持随机匹配和实时语音翻译
"""

import asyncio
import json
import random
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
import uuid
from queue import Queue
import threading

from ..database import db, VoiceCallSession, UserMatchingPreference
from ..services.realtime_translation import realtime_translation_service

class VoiceCallMatchingService:
    """语音通话匹配服务类"""
    
    def __init__(self):
        self.waiting_users = {}  # 等待匹配的用户
        self.active_calls = {}   # 活跃的通话会话
        self.matching_queue = Queue()  # 匹配队列
        self.call_rooms = {}     # 通话房间
        
        # 启动匹配处理线程
        self.matching_thread = threading.Thread(target=self._process_matching_queue)
        self.matching_thread.daemon = True
        self.matching_thread.start()
    
    # 同步方法包装器
    def join_matching_queue_sync(self, user_id: str, user_language: str, target_languages: List[str] = None, preferences: Dict[str, Any] = None) -> Dict[str, Any]:
        """加入匹配队列（同步版本）"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self.join_matching_queue(user_id, user_language, target_languages, preferences))
        finally:
            loop.close()
    
    def leave_matching_queue_sync(self, user_id: str) -> Dict[str, Any]:
        """离开匹配队列（同步版本）"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self.leave_matching_queue(user_id))
        finally:
            loop.close()
    
    def process_call_audio_sync(self, call_session_id: str, user_id: str, audio_data: bytes, chunk_index: int = 0) -> Dict[str, Any]:
        """处理通话音频（同步版本）"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self.process_call_audio(call_session_id, user_id, audio_data, chunk_index))
        finally:
            loop.close()
    
    def end_voice_call_sync(self, call_session_id: str, user_id: str) -> Dict[str, Any]:
        """结束语音通话（同步版本）"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self.end_voice_call(call_session_id, user_id))
        finally:
            loop.close()
    
    def get_call_status_sync(self, call_session_id: str, user_id: str) -> Dict[str, Any]:
        """获取通话状态（同步版本）"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self.get_call_status(call_session_id, user_id))
        finally:
            loop.close()
    
    def get_user_call_history_sync(self, user_id: str, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
        """获取用户通话历史（同步版本）"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self.get_user_call_history(user_id, limit, offset))
        finally:
            loop.close()
    
    def update_user_preferences_sync(self, user_id: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
        """更新用户匹配偏好（同步版本）"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self.update_user_preferences(user_id, preferences))
        finally:
            loop.close()
    
    # 异步方法
    async def join_matching_queue(
        self,
        user_id: str,
        user_language: str,
        target_languages: List[str] = None,
        preferences: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """加入匹配队列"""
        
        try:
            # 检查用户是否已在队列中
            if user_id in self.waiting_users:
                return {
                    'success': False,
                    'error': 'Already in queue',
                    'message': '用户已在匹配队列中'
                }
            
            # 检查用户是否已在通话中
            for call_id, call_info in self.active_calls.items():
                if user_id in [call_info['caller_id'], call_info['callee_id']]:
                    return {
                        'success': False,
                        'error': 'Already in call',
                        'message': '用户已在通话中'
                    }
            
            # 创建匹配请求
            matching_request = {
                'user_id': user_id,
                'user_language': user_language,
                'target_languages': target_languages or [],
                'preferences': preferences or {},
                'joined_at': datetime.now(),
                'status': 'waiting'
            }
            
            # 添加到等待队列
            self.waiting_users[user_id] = matching_request
            
            # 添加到匹配队列进行处理
            self.matching_queue.put({
                'action': 'match_user',
                'user_id': user_id,
                'request': matching_request
            })
            
            return {
                'success': True,
                'message': '已加入匹配队列',
                'queue_position': len(self.waiting_users),
                'estimated_wait_time': self._estimate_wait_time()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': '加入匹配队列失败'
            }
    
    async def leave_matching_queue(self, user_id: str) -> Dict[str, Any]:
        """离开匹配队列"""
        
        try:
            if user_id in self.waiting_users:
                del self.waiting_users[user_id]
                
                return {
                    'success': True,
                    'message': '已离开匹配队列'
                }
            else:
                return {
                    'success': False,
                    'error': 'Not in queue',
                    'message': '用户不在匹配队列中'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': '离开匹配队列失败'
            }
    
    async def start_voice_call(
        self,
        caller_id: str,
        callee_id: str,
        caller_language: str,
        callee_language: str
    ) -> Dict[str, Any]:
        """开始语音通话"""
        
        try:
            # 生成通话会话ID
            call_session_id = f"call_{uuid.uuid4().hex[:12]}"
            
            # 创建通话房间
            call_room = {
                'session_id': call_session_id,
                'caller_id': caller_id,
                'callee_id': callee_id,
                'caller_language': caller_language,
                'callee_language': callee_language,
                'started_at': datetime.now(),
                'status': 'connected',
                'translation_sessions': {},
                'participants': [caller_id, callee_id]
            }
            
            self.call_rooms[call_session_id] = call_room
            self.active_calls[call_session_id] = call_room
            
            # 从等待队列中移除用户
            self.waiting_users.pop(caller_id, None)
            self.waiting_users.pop(callee_id, None)
            
            # 为每个用户创建翻译会话
            await self._setup_call_translation(call_session_id, caller_id, callee_id, caller_language, callee_language)
            
            return {
                'success': True,
                'call_session_id': call_session_id,
                'caller_id': caller_id,
                'callee_id': callee_id,
                'caller_language': caller_language,
                'callee_language': callee_language,
                'message': '语音通话已开始'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': '开始语音通话失败'
            }
    
    async def end_voice_call(self, call_session_id: str, user_id: str) -> Dict[str, Any]:
        """结束语音通话"""
        
        try:
            if call_session_id not in self.active_calls:
                return {
                    'success': False,
                    'error': 'Call not found',
                    'message': '通话会话不存在'
                }
            
            call_info = self.active_calls[call_session_id]
            
            # 检查用户权限
            if user_id not in [call_info['caller_id'], call_info['callee_id']]:
                return {
                    'success': False,
                    'error': 'Access denied',
                    'message': '无权限结束此通话'
                }
            
            # 停止翻译会话
            await self._cleanup_call_translation(call_session_id)
            
            # 从活跃通话中移除
            del self.active_calls[call_session_id]
            self.call_rooms.pop(call_session_id, None)
            
            return {
                'success': True,
                'call_session_id': call_session_id,
                'message': '语音通话已结束'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': '结束语音通话失败'
            }
    
    async def process_call_audio(
        self,
        call_session_id: str,
        user_id: str,
        audio_data: bytes,
        chunk_index: int = 0
    ) -> Dict[str, Any]:
        """处理通话音频"""
        
        try:
            if call_session_id not in self.active_calls:
                return {
                    'success': False,
                    'error': 'Call not found',
                    'message': '通话会话不存在'
                }
            
            call_info = self.active_calls[call_session_id]
            
            # 检查用户权限
            if user_id not in [call_info['caller_id'], call_info['callee_id']]:
                return {
                    'success': False,
                    'error': 'Access denied',
                    'message': '无权限处理此通话音频'
                }
            
            # 获取用户的翻译会话
            translation_session_id = call_info['translation_sessions'].get(user_id)
            if not translation_session_id:
                return {
                    'success': False,
                    'error': 'Translation session not found',
                    'message': '翻译会话不存在'
                }
            
            # 处理音频
            result = await realtime_translation_service.process_audio_chunk(
                translation_session_id,
                audio_data,
                chunk_index
            )
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': '处理通话音频失败'
            }
    
    async def get_call_status(self, call_session_id: str, user_id: str) -> Dict[str, Any]:
        """获取通话状态"""
        
        try:
            if call_session_id not in self.active_calls:
                return {
                    'success': False,
                    'error': 'Call not found',
                    'message': '通话会话不存在'
                }
            
            call_info = self.active_calls[call_session_id]
            
            # 检查用户权限
            if user_id not in [call_info['caller_id'], call_info['callee_id']]:
                return {
                    'success': False,
                    'error': 'Access denied',
                    'message': '无权限查看此通话状态'
                }
            
            # 计算通话时长
            duration = int((datetime.now() - call_info['started_at']).total_seconds())
            
            return {
                'success': True,
                'call_session_id': call_session_id,
                'status': call_info['status'],
                'duration': duration,
                'participants': call_info['participants'],
                'caller_language': call_info['caller_language'],
                'callee_language': call_info['callee_language'],
                'total_translations': 0,  # 简化实现
                'started_at': call_info['started_at'].isoformat()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': '获取通话状态失败'
            }
    
    async def get_user_call_history(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """获取用户通话历史"""
        
        try:
            # 这里应该从数据库查询，但为了简化，返回空列表
            return []
            
        except Exception as e:
            print(f"获取用户通话历史失败: {str(e)}")
            return []
    
    async def update_user_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any]
    ) -> Dict[str, Any]:
        """更新用户匹配偏好"""
        
        try:
            # 这里应该更新数据库，但为了简化，直接返回成功
            return {
                'success': True,
                'message': '偏好设置已更新',
                'preferences': preferences
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': '更新偏好设置失败'
            }
    
    def _process_matching_queue(self):
        """处理匹配队列（在单独线程中运行）"""
        
        while True:
            try:
                # 从队列获取匹配任务
                task = self.matching_queue.get(timeout=1)
                
                if task['action'] == 'match_user':
                    # 使用新的事件循环
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        loop.run_until_complete(self._find_match_for_user(task['user_id'], task['request']))
                    finally:
                        loop.close()
                
                # 标记任务完成
                self.matching_queue.task_done()
                
            except Exception as e:
                if "Empty" not in str(e):  # 忽略队列为空的异常
                    print(f"处理匹配队列错误: {str(e)}")
    
    async def _find_match_for_user(self, user_id: str, request: Dict[str, Any]):
        """为用户寻找匹配"""
        
        try:
            user_language = request['user_language']
            target_languages = request['target_languages']
            
            # 寻找合适的匹配用户
            best_match = None
            best_score = 0
            
            for other_user_id, other_request in self.waiting_users.items():
                if other_user_id == user_id:
                    continue
                
                # 计算匹配分数
                score = self._calculate_match_score(request, other_request)
                
                if score > best_score and score >= 0.5:  # 最低匹配分数阈值
                    best_match = other_user_id
                    best_score = score
            
            # 如果找到匹配，开始通话
            if best_match:
                other_request = self.waiting_users[best_match]
                
                await self.start_voice_call(
                    caller_id=user_id,
                    callee_id=best_match,
                    caller_language=user_language,
                    callee_language=other_request['user_language']
                )
                
                print(f"匹配成功: {user_id} <-> {best_match} (分数: {best_score})")
            
        except Exception as e:
            print(f"寻找匹配失败: {str(e)}")
    
    def _calculate_match_score(self, request1: Dict[str, Any], request2: Dict[str, Any]) -> float:
        """计算匹配分数"""
        
        score = 0.0
        
        # 语言匹配 (权重: 0.4)
        lang1 = request1['user_language']
        lang2 = request2['user_language']
        target_langs1 = request1['target_languages']
        target_langs2 = request2['target_languages']
        
        if lang2 in target_langs1 or lang1 in target_langs2:
            score += 0.4
        elif lang1 != lang2:  # 不同语言也有基础分数
            score += 0.2
        
        # 等待时间 (权重: 0.3)
        wait_time1 = (datetime.now() - request1['joined_at']).total_seconds()
        wait_time2 = (datetime.now() - request2['joined_at']).total_seconds()
        avg_wait_time = (wait_time1 + wait_time2) / 2
        
        # 等待时间越长，匹配分数越高
        if avg_wait_time > 300:  # 5分钟以上
            score += 0.3
        elif avg_wait_time > 120:  # 2分钟以上
            score += 0.2
        elif avg_wait_time > 60:   # 1分钟以上
            score += 0.1
        
        # 偏好匹配 (权重: 0.3)
        prefs1 = request1.get('preferences', {})
        prefs2 = request2.get('preferences', {})
        
        # 兴趣匹配
        interests1 = set(prefs1.get('interests', []))
        interests2 = set(prefs2.get('interests', []))
        
        if interests1 and interests2:
            common_interests = len(interests1.intersection(interests2))
            total_interests = len(interests1.union(interests2))
            if total_interests > 0:
                score += 0.15 * (common_interests / total_interests)
        
        # 年龄范围匹配
        age_range1 = prefs1.get('age_range', {})
        age_range2 = prefs2.get('age_range', {})
        
        if age_range1 and age_range2:
            # 简化的年龄匹配逻辑
            score += 0.15
        
        return min(score, 1.0)  # 确保分数不超过1.0
    
    async def _setup_call_translation(
        self,
        call_session_id: str,
        caller_id: str,
        callee_id: str,
        caller_language: str,
        callee_language: str
    ):
        """设置通话翻译"""
        
        try:
            call_info = self.call_rooms[call_session_id]
            
            # 为主叫用户创建翻译会话
            caller_session = await realtime_translation_service.start_external_audio_session(
                user_id=caller_id,
                source_lang=caller_language,
                target_lang=callee_language,
                session_config={
                    'real_time_threshold': 1.5,  # 通话中更快的响应
                    'noise_reduction': True
                }
            )
            
            if caller_session['success']:
                call_info['translation_sessions'][caller_id] = caller_session['session_id']
            
            # 为被叫用户创建翻译会话
            callee_session = await realtime_translation_service.start_external_audio_session(
                user_id=callee_id,
                source_lang=callee_language,
                target_lang=caller_language,
                session_config={
                    'real_time_threshold': 1.5,
                    'noise_reduction': True
                }
            )
            
            if callee_session['success']:
                call_info['translation_sessions'][callee_id] = callee_session['session_id']
            
        except Exception as e:
            print(f"设置通话翻译失败: {str(e)}")
    
    async def _cleanup_call_translation(self, call_session_id: str):
        """清理通话翻译"""
        
        try:
            if call_session_id in self.call_rooms:
                call_info = self.call_rooms[call_session_id]
                
                # 停止所有翻译会话
                for user_id, translation_session_id in call_info['translation_sessions'].items():
                    await realtime_translation_service.stop_session(translation_session_id)
                
        except Exception as e:
            print(f"清理通话翻译失败: {str(e)}")
    
    def _estimate_wait_time(self) -> int:
        """估算等待时间（秒）"""
        
        queue_length = len(self.waiting_users)
        
        if queue_length <= 1:
            return 30  # 30秒
        elif queue_length <= 5:
            return 60  # 1分钟
        elif queue_length <= 10:
            return 120  # 2分钟
        else:
            return 300  # 5分钟
    
    def get_queue_status(self) -> Dict[str, Any]:
        """获取队列状态"""
        
        return {
            'waiting_users': len(self.waiting_users),
            'active_calls': len(self.active_calls),
            'total_rooms': len(self.call_rooms)
        }

# 创建全局实例
voice_call_service = VoiceCallMatchingService()

