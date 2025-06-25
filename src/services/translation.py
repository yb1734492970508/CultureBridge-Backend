"""
CultureBridge Backend AI Translation Service
增强版AI翻译服务，支持多种翻译引擎和语音功能
"""

import asyncio
import aiohttp
import openai
import speech_recognition as sr
import azure.cognitiveservices.speech as speechsdk
from googletrans import Translator
from typing import Optional, Dict, Any, List, Tuple
import json
import base64
import io
from pydub import AudioSegment
import tempfile
import os

from src.config import config
from src.models import db, Translation, User, Language

class TranslationError(Exception):
    """翻译错误"""
    pass

class AITranslationService:
    """AI翻译服务类"""
    
    def __init__(self):
        # 初始化各种翻译服务
        self.google_translator = Translator()
        
        # OpenAI客户端
        if config.ai.OPENAI_API_KEY:
            openai.api_key = config.ai.OPENAI_API_KEY
        
        # Azure语音服务
        if config.ai.AZURE_SPEECH_KEY:
            self.speech_config = speechsdk.SpeechConfig(
                subscription=config.ai.AZURE_SPEECH_KEY,
                region=config.ai.AZURE_SPEECH_REGION
            )
        
        # 支持的语言映射
        self.language_mapping = {
            'zh': 'zh-CN',
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'ar': 'ar-SA',
            'ru': 'ru-RU',
            'pt': 'pt-PT',
            'it': 'it-IT',
            'nl': 'nl-NL',
            'sv': 'sv-SE',
            'da': 'da-DK',
            'no': 'no-NO',
            'fi': 'fi-FI',
            'pl': 'pl-PL',
            'tr': 'tr-TR',
            'hi': 'hi-IN',
            'th': 'th-TH',
            'vi': 'vi-VN'
        }
    
    async def translate_text(
        self, 
        text: str, 
        source_lang: str, 
        target_lang: str,
        user_id: Optional[str] = None,
        method: str = 'auto'
    ) -> Dict[str, Any]:
        """翻译文本"""
        
        if not text.strip():
            raise TranslationError("Text cannot be empty")
        
        # 自动选择最佳翻译方法
        if method == 'auto':
            method = self._select_best_method(source_lang, target_lang, text)
        
        # 执行翻译
        if method == 'openai':
            result = await self._translate_with_openai(text, source_lang, target_lang)
        elif method == 'google':
            result = await self._translate_with_google(text, source_lang, target_lang)
        elif method == 'azure':
            result = await self._translate_with_azure(text, source_lang, target_lang)
        else:
            raise TranslationError(f"Unsupported translation method: {method}")
        
        # 保存翻译记录
        if user_id:
            translation_record = Translation(
                user_id=user_id,
                source_text=text,
                target_text=result['translated_text'],
                source_language=source_lang,
                target_language=target_lang,
                translation_method=method,
                confidence_score=result.get('confidence', 0.0)
            )
            db.session.add(translation_record)
            db.session.commit()
            
            # 更新用户翻译统计
            user = User.query.get(user_id)
            if user:
                user.total_translations += 1
                db.session.commit()
        
        return {
            'source_text': text,
            'translated_text': result['translated_text'],
            'source_language': source_lang,
            'target_language': target_lang,
            'method': method,
            'confidence': result.get('confidence', 0.0),
            'alternatives': result.get('alternatives', []),
            'detected_language': result.get('detected_language')
        }
    
    async def translate_batch(
        self,
        texts: List[str],
        source_lang: str,
        target_lang: str,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """批量翻译"""
        
        tasks = []
        for text in texts:
            task = self.translate_text(text, source_lang, target_lang, user_id)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 处理结果和异常
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    'source_text': texts[i],
                    'error': str(result),
                    'success': False
                })
            else:
                result['success'] = True
                processed_results.append(result)
        
        return processed_results
    
    async def detect_language(self, text: str) -> Dict[str, Any]:
        """检测语言"""
        
        try:
            # 使用Google翻译检测语言
            detected = self.google_translator.detect(text)
            
            return {
                'language': detected.lang,
                'confidence': detected.confidence,
                'text': text
            }
        except Exception as e:
            # 备用方案：使用OpenAI
            if config.ai.OPENAI_API_KEY:
                return await self._detect_language_with_openai(text)
            else:
                raise TranslationError(f"Language detection failed: {str(e)}")
    
    async def speech_to_text(
        self,
        audio_data: bytes,
        language: str = 'auto',
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """语音转文字"""
        
        try:
            # 保存音频文件到临时位置
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            # 使用Azure语音服务
            if config.ai.AZURE_SPEECH_KEY:
                result = await self._speech_to_text_azure(temp_file_path, language)
            else:
                # 备用方案：使用SpeechRecognition库
                result = await self._speech_to_text_google(temp_file_path, language)
            
            # 清理临时文件
            os.unlink(temp_file_path)
            
            return result
            
        except Exception as e:
            raise TranslationError(f"Speech to text failed: {str(e)}")
    
    async def text_to_speech(
        self,
        text: str,
        language: str,
        voice: str = 'default',
        user_id: Optional[str] = None
    ) -> bytes:
        """文字转语音"""
        
        try:
            if config.ai.AZURE_SPEECH_KEY:
                return await self._text_to_speech_azure(text, language, voice)
            else:
                raise TranslationError("Text to speech service not available")
                
        except Exception as e:
            raise TranslationError(f"Text to speech failed: {str(e)}")
    
    async def get_supported_languages(self) -> List[Dict[str, Any]]:
        """获取支持的语言列表"""
        
        languages = Language.query.filter_by(is_active=True).all()
        
        supported_languages = []
        for lang in languages:
            supported_languages.append({
                'code': lang.code,
                'name': lang.name,
                'native_name': lang.native_name,
                'flag_emoji': lang.flag_emoji,
                'supports_speech': lang.code in self.language_mapping,
                'supports_translation': True
            })
        
        return supported_languages
    
    async def get_translation_history(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """获取翻译历史"""
        
        translations = Translation.query.filter_by(user_id=user_id)\
            .order_by(Translation.created_at.desc())\
            .limit(limit)\
            .offset(offset)\
            .all()
        
        return [translation.to_dict() for translation in translations]
    
    def _select_best_method(self, source_lang: str, target_lang: str, text: str) -> str:
        """选择最佳翻译方法"""
        
        # 根据语言对和文本长度选择最佳方法
        text_length = len(text)
        
        # 对于长文本，优先使用OpenAI
        if text_length > 1000 and config.ai.OPENAI_API_KEY:
            return 'openai'
        
        # 对于中英文翻译，优先使用Google
        if (source_lang in ['zh', 'en'] and target_lang in ['zh', 'en']):
            return 'google'
        
        # 默认使用Google翻译
        return 'google'
    
    async def _translate_with_openai(
        self,
        text: str,
        source_lang: str,
        target_lang: str
    ) -> Dict[str, Any]:
        """使用OpenAI翻译"""
        
        if not config.ai.OPENAI_API_KEY:
            raise TranslationError("OpenAI API key not configured")
        
        # 构建提示词
        prompt = f"""
        Translate the following text from {source_lang} to {target_lang}.
        Provide a natural, accurate translation that preserves the meaning and tone.
        
        Text to translate: {text}
        
        Translation:
        """
        
        try:
            response = await openai.ChatCompletion.acreate(
                model=config.ai.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are a professional translator."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.3
            )
            
            translated_text = response.choices[0].message.content.strip()
            
            return {
                'translated_text': translated_text,
                'confidence': 0.9,  # OpenAI通常质量较高
                'alternatives': []
            }
            
        except Exception as e:
            raise TranslationError(f"OpenAI translation failed: {str(e)}")
    
    async def _translate_with_google(
        self,
        text: str,
        source_lang: str,
        target_lang: str
    ) -> Dict[str, Any]:
        """使用Google翻译"""
        
        try:
            result = self.google_translator.translate(
                text,
                src=source_lang,
                dest=target_lang
            )
            
            return {
                'translated_text': result.text,
                'confidence': 0.8,  # Google翻译通常较可靠
                'detected_language': result.src,
                'alternatives': []
            }
            
        except Exception as e:
            raise TranslationError(f"Google translation failed: {str(e)}")
    
    async def _translate_with_azure(
        self,
        text: str,
        source_lang: str,
        target_lang: str
    ) -> Dict[str, Any]:
        """使用Azure翻译"""
        
        # 这里需要实现Azure翻译API调用
        # 由于需要Azure翻译服务的API密钥，这里提供一个框架
        
        raise TranslationError("Azure translation not implemented yet")
    
    async def _detect_language_with_openai(self, text: str) -> Dict[str, Any]:
        """使用OpenAI检测语言"""
        
        prompt = f"""
        Detect the language of the following text and return only the ISO 639-1 language code:
        
        Text: {text}
        
        Language code:
        """
        
        try:
            response = await openai.ChatCompletion.acreate(
                model=config.ai.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are a language detection expert."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=10,
                temperature=0
            )
            
            language_code = response.choices[0].message.content.strip().lower()
            
            return {
                'language': language_code,
                'confidence': 0.8,
                'text': text
            }
            
        except Exception as e:
            raise TranslationError(f"OpenAI language detection failed: {str(e)}")
    
    async def _speech_to_text_azure(
        self,
        audio_file_path: str,
        language: str
    ) -> Dict[str, Any]:
        """使用Azure语音服务进行语音识别"""
        
        try:
            # 设置音频配置
            audio_config = speechsdk.audio.AudioConfig(filename=audio_file_path)
            
            # 设置语言
            if language != 'auto':
                speech_language = self.language_mapping.get(language, language)
                self.speech_config.speech_recognition_language = speech_language
            
            # 创建语音识别器
            speech_recognizer = speechsdk.SpeechRecognizer(
                speech_config=self.speech_config,
                audio_config=audio_config
            )
            
            # 执行识别
            result = speech_recognizer.recognize_once()
            
            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                return {
                    'text': result.text,
                    'confidence': 0.9,
                    'language': language
                }
            else:
                raise TranslationError(f"Speech recognition failed: {result.reason}")
                
        except Exception as e:
            raise TranslationError(f"Azure speech to text failed: {str(e)}")
    
    async def _speech_to_text_google(
        self,
        audio_file_path: str,
        language: str
    ) -> Dict[str, Any]:
        """使用Google语音识别"""
        
        try:
            recognizer = sr.Recognizer()
            
            with sr.AudioFile(audio_file_path) as source:
                audio = recognizer.record(source)
            
            # 设置语言
            speech_language = self.language_mapping.get(language, 'en-US')
            
            # 执行识别
            text = recognizer.recognize_google(audio, language=speech_language)
            
            return {
                'text': text,
                'confidence': 0.8,
                'language': language
            }
            
        except sr.UnknownValueError:
            raise TranslationError("Could not understand audio")
        except sr.RequestError as e:
            raise TranslationError(f"Google speech recognition error: {str(e)}")
    
    async def _text_to_speech_azure(
        self,
        text: str,
        language: str,
        voice: str
    ) -> bytes:
        """使用Azure语音服务进行文字转语音"""
        
        try:
            # 设置语音配置
            speech_language = self.language_mapping.get(language, 'en-US')
            
            # 选择语音
            voice_name = self._get_voice_name(speech_language, voice)
            self.speech_config.speech_synthesis_voice_name = voice_name
            
            # 创建语音合成器
            synthesizer = speechsdk.SpeechSynthesizer(
                speech_config=self.speech_config,
                audio_config=None
            )
            
            # 执行合成
            result = synthesizer.speak_text_async(text).get()
            
            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                return result.audio_data
            else:
                raise TranslationError(f"Speech synthesis failed: {result.reason}")
                
        except Exception as e:
            raise TranslationError(f"Azure text to speech failed: {str(e)}")
    
    def _get_voice_name(self, language: str, voice: str) -> str:
        """获取语音名称"""
        
        # 语音映射表
        voice_mapping = {
            'en-US': {
                'default': 'en-US-JennyNeural',
                'male': 'en-US-GuyNeural',
                'female': 'en-US-JennyNeural'
            },
            'zh-CN': {
                'default': 'zh-CN-XiaoxiaoNeural',
                'male': 'zh-CN-YunxiNeural',
                'female': 'zh-CN-XiaoxiaoNeural'
            },
            'es-ES': {
                'default': 'es-ES-ElviraNeural',
                'male': 'es-ES-AlvaroNeural',
                'female': 'es-ES-ElviraNeural'
            },
            'fr-FR': {
                'default': 'fr-FR-DeniseNeural',
                'male': 'fr-FR-HenriNeural',
                'female': 'fr-FR-DeniseNeural'
            },
            'de-DE': {
                'default': 'de-DE-KatjaNeural',
                'male': 'de-DE-ConradNeural',
                'female': 'de-DE-KatjaNeural'
            },
            'ja-JP': {
                'default': 'ja-JP-NanamiNeural',
                'male': 'ja-JP-KeitaNeural',
                'female': 'ja-JP-NanamiNeural'
            }
        }
        
        lang_voices = voice_mapping.get(language, voice_mapping['en-US'])
        return lang_voices.get(voice, lang_voices['default'])

# 全局翻译服务实例
translation_service = AITranslationService()

# 导出
__all__ = ['AITranslationService', 'translation_service', 'TranslationError']

