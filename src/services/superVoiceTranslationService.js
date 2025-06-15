const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');
const translate = require('@google-cloud/translate').v2.Translate;
const { databaseManager } = require('../utils/databaseManager');
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const EventEmitter = require('events');

class SuperVoiceTranslationService extends EventEmitter {
  constructor() {
    super();
    
    // Google Cloud 客户端
    this.speechClient = new speech.SpeechClient({
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });
    
    this.ttsClient = new textToSpeech.TextToSpeechClient({
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });
    
    this.translateClient = new translate.Translate({
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });

    // 配置
    this.config = {
      maxAudioDuration: 60, // 最大音频时长（秒）
      maxFileSize: 10 * 1024 * 1024, // 最大文件大小（10MB）
      supportedFormats: ['wav', 'mp3', 'flac', 'ogg', 'webm'],
      qualityThreshold: 0.7, // 音频质量阈值
      cacheEnabled: true,
      cacheTTL: 3600, // 缓存1小时
      batchSize: 5, // 批处理大小
      retryAttempts: 3,
      retryDelay: 1000
    };

    // 支持的语言
    this.supportedLanguages = {
      'zh-CN': { name: '中文（简体）', voice: 'zh-CN-Wavenet-A' },
      'zh-TW': { name: '中文（繁体）', voice: 'zh-TW-Wavenet-A' },
      'en-US': { name: '英语（美国）', voice: 'en-US-Wavenet-D' },
      'en-GB': { name: '英语（英国）', voice: 'en-GB-Wavenet-A' },
      'ja-JP': { name: '日语', voice: 'ja-JP-Wavenet-A' },
      'ko-KR': { name: '韩语', voice: 'ko-KR-Wavenet-A' },
      'fr-FR': { name: '法语', voice: 'fr-FR-Wavenet-A' },
      'de-DE': { name: '德语', voice: 'de-DE-Wavenet-A' },
      'es-ES': { name: '西班牙语', voice: 'es-ES-Wavenet-A' },
      'it-IT': { name: '意大利语', voice: 'it-IT-Wavenet-A' },
      'pt-BR': { name: '葡萄牙语（巴西）', voice: 'pt-BR-Wavenet-A' },
      'ru-RU': { name: '俄语', voice: 'ru-RU-Wavenet-A' },
      'ar-XA': { name: '阿拉伯语', voice: 'ar-XA-Wavenet-A' },
      'hi-IN': { name: '印地语', voice: 'hi-IN-Wavenet-A' },
      'th-TH': { name: '泰语', voice: 'th-TH-Wavenet-A' },
      'vi-VN': { name: '越南语', voice: 'vi-VN-Wavenet-A' }
    };

    // 统计数据
    this.stats = {
      totalTranslations: 0,
      successfulTranslations: 0,
      failedTranslations: 0,
      totalAudioProcessed: 0,
      averageProcessingTime: 0,
      languageUsage: {},
      qualityScores: []
    };

    // 处理队列
    this.processingQueue = [];
    this.isProcessing = false;
    
    // 初始化
    this.initialize();
  }

  // 初始化服务
  async initialize() {
    try {
      console.log('🔄 初始化超级语音翻译服务...');
      
      // 创建临时目录
      await this.ensureDirectories();
      
      // 验证Google Cloud配置
      await this.validateGoogleCloudConfig();
      
      // 启动处理队列
      this.startProcessingQueue();
      
      // 加载统计数据
      await this.loadStats();
      
      console.log('✅ 超级语音翻译服务初始化完成');
      this.emit('serviceReady');
    } catch (error) {
      console.error('❌ 语音翻译服务初始化失败:', error);
      throw error;
    }
  }

  // 确保目录存在
  async ensureDirectories() {
    const dirs = [
      path.join(__dirname, '../../temp/audio'),
      path.join(__dirname, '../../temp/processed'),
      path.join(__dirname, '../../temp/output')
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    }
  }

  // 验证Google Cloud配置
  async validateGoogleCloudConfig() {
    try {
      // 测试语音识别
      await this.speechClient.getClient();
      
      // 测试文本转语音
      await this.ttsClient.getClient();
      
      // 测试翻译
      const [languages] = await this.translateClient.getLanguages();
      
      console.log(`✅ Google Cloud配置验证成功，支持 ${languages.length} 种语言`);
    } catch (error) {
      console.error('❌ Google Cloud配置验证失败:', error);
      throw new Error('Google Cloud服务配置无效');
    }
  }

  // 启动处理队列
  startProcessingQueue() {
    setInterval(async () => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        await this.processQueue();
      }
    }, 1000);
  }

  // 处理队列
  async processQueue() {
    if (this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batch = this.processingQueue.splice(0, this.config.batchSize);
    
    console.log(`🔄 处理语音翻译批次: ${batch.length} 个任务`);

    const results = await Promise.allSettled(
      batch.map(task => this.executeTranslationTask(task))
    );

    results.forEach((result, index) => {
      const task = batch[index];
      
      if (result.status === 'fulfilled') {
        task.resolve(result.value);
      } else {
        task.reject(result.reason);
      }
    });

    this.isProcessing = false;
  }

  // 执行翻译任务
  async executeTranslationTask(task) {
    const startTime = Date.now();
    
    try {
      const { audioBuffer, sourceLanguage, targetLanguage, options } = task.params;
      
      // 1. 音频质量检测
      const qualityScore = await this.analyzeAudioQuality(audioBuffer);
      
      if (qualityScore < this.config.qualityThreshold) {
        throw new Error(`音频质量不足: ${qualityScore.toFixed(2)}`);
      }

      // 2. 音频预处理
      const processedAudio = await this.preprocessAudio(audioBuffer, options);
      
      // 3. 语音识别
      const recognizedText = await this.speechToText(processedAudio, sourceLanguage, options);
      
      if (!recognizedText || recognizedText.trim().length === 0) {
        throw new Error('语音识别失败：未检测到有效语音');
      }

      // 4. 文本翻译
      const translatedText = await this.translateText(recognizedText, sourceLanguage, targetLanguage);
      
      // 5. 语音合成
      const synthesizedAudio = await this.textToSpeech(translatedText, targetLanguage, options);
      
      // 6. 更新统计
      const processingTime = Date.now() - startTime;
      await this.updateStats(sourceLanguage, targetLanguage, processingTime, qualityScore, true);
      
      // 7. 缓存结果
      if (this.config.cacheEnabled) {
        await this.cacheTranslationResult(audioBuffer, sourceLanguage, targetLanguage, {
          originalText: recognizedText,
          translatedText,
          synthesizedAudio,
          qualityScore,
          processingTime
        });
      }

      const result = {
        success: true,
        originalText: recognizedText,
        translatedText,
        synthesizedAudio,
        qualityScore,
        processingTime,
        sourceLanguage,
        targetLanguage,
        timestamp: new Date()
      };

      this.emit('translationComplete', result);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      await this.updateStats(task.params.sourceLanguage, task.params.targetLanguage, processingTime, 0, false);
      
      const errorResult = {
        success: false,
        error: error.message,
        processingTime,
        timestamp: new Date()
      };

      this.emit('translationError', errorResult);
      throw error;
    }
  }

  // 音频质量分析
  async analyzeAudioQuality(audioBuffer) {
    return new Promise((resolve, reject) => {
      const tempFile = path.join(__dirname, '../../temp/audio', `quality_${Date.now()}.wav`);
      
      // 保存临时文件
      fs.writeFile(tempFile, audioBuffer)
        .then(() => {
          // 使用FFmpeg分析音频质量
          ffmpeg(tempFile)
            .audioFilters('volumedetect')
            .format('null')
            .output('-')
            .on('stderr', (stderrLine) => {
              // 解析音频质量指标
              if (stderrLine.includes('mean_volume')) {
                const volumeMatch = stderrLine.match(/mean_volume:\s*([-\d.]+)\s*dB/);
                if (volumeMatch) {
                  const meanVolume = parseFloat(volumeMatch[1]);
                  // 基于音量计算质量分数（简化算法）
                  const qualityScore = Math.max(0, Math.min(1, (meanVolume + 60) / 60));
                  resolve(qualityScore);
                }
              }
            })
            .on('error', (err) => {
              console.error('音频质量分析失败:', err);
              resolve(0.5); // 默认中等质量
            })
            .on('end', () => {
              // 清理临时文件
              fs.unlink(tempFile).catch(console.error);
            })
            .run();
        })
        .catch(reject);
    });
  }

  // 音频预处理
  async preprocessAudio(audioBuffer, options = {}) {
    return new Promise((resolve, reject) => {
      const inputFile = path.join(__dirname, '../../temp/audio', `input_${Date.now()}.wav`);
      const outputFile = path.join(__dirname, '../../temp/processed', `processed_${Date.now()}.wav`);
      
      fs.writeFile(inputFile, audioBuffer)
        .then(() => {
          let command = ffmpeg(inputFile)
            .audioCodec('pcm_s16le')
            .audioFrequency(16000)
            .audioChannels(1);

          // 音频增强
          if (options.enhanceAudio !== false) {
            command = command
              .audioFilters([
                'highpass=f=80',      // 高通滤波器，去除低频噪音
                'lowpass=f=8000',     // 低通滤波器，去除高频噪音
                'volume=1.5',         // 音量增强
                'dynaudnorm=p=0.9'    // 动态音频标准化
              ]);
          }

          command
            .output(outputFile)
            .on('error', (err) => {
              console.error('音频预处理失败:', err);
              reject(err);
            })
            .on('end', async () => {
              try {
                const processedBuffer = await fs.readFile(outputFile);
                
                // 清理临时文件
                await Promise.all([
                  fs.unlink(inputFile).catch(console.error),
                  fs.unlink(outputFile).catch(console.error)
                ]);
                
                resolve(processedBuffer);
              } catch (error) {
                reject(error);
              }
            })
            .run();
        })
        .catch(reject);
    });
  }

  // 语音转文本
  async speechToText(audioBuffer, language, options = {}) {
    try {
      // 检查缓存
      if (this.config.cacheEnabled) {
        const cacheKey = this.generateCacheKey('stt', audioBuffer, language);
        const cached = await databaseManager.cacheGet(cacheKey);
        if (cached) {
          return cached.text;
        }
      }

      const request = {
        audio: {
          content: audioBuffer.toString('base64')
        },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: language,
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          enableWordConfidence: true,
          maxAlternatives: 3,
          profanityFilter: options.profanityFilter !== false,
          speechContexts: options.speechContexts || [],
          adaptation: {
            phraseSets: options.phraseSets || []
          }
        }
      };

      const [response] = await this.speechClient.recognize(request);
      
      if (!response.results || response.results.length === 0) {
        throw new Error('语音识别未返回结果');
      }

      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join(' ');

      // 缓存结果
      if (this.config.cacheEnabled) {
        const cacheKey = this.generateCacheKey('stt', audioBuffer, language);
        await databaseManager.cacheSet(cacheKey, { text: transcription }, this.config.cacheTTL);
      }

      return transcription;
    } catch (error) {
      console.error('语音转文本失败:', error);
      throw new Error(`语音识别失败: ${error.message}`);
    }
  }

  // 文本翻译
  async translateText(text, sourceLanguage, targetLanguage) {
    try {
      // 如果源语言和目标语言相同，直接返回
      if (sourceLanguage === targetLanguage) {
        return text;
      }

      // 检查缓存
      if (this.config.cacheEnabled) {
        const cacheKey = this.generateCacheKey('translate', text, `${sourceLanguage}-${targetLanguage}`);
        const cached = await databaseManager.cacheGet(cacheKey);
        if (cached) {
          return cached.text;
        }
      }

      const [translation] = await this.translateClient.translate(text, {
        from: sourceLanguage,
        to: targetLanguage,
        format: 'text'
      });

      // 缓存结果
      if (this.config.cacheEnabled) {
        const cacheKey = this.generateCacheKey('translate', text, `${sourceLanguage}-${targetLanguage}`);
        await databaseManager.cacheSet(cacheKey, { text: translation }, this.config.cacheTTL);
      }

      return translation;
    } catch (error) {
      console.error('文本翻译失败:', error);
      throw new Error(`翻译失败: ${error.message}`);
    }
  }

  // 文本转语音
  async textToSpeech(text, language, options = {}) {
    try {
      // 检查缓存
      if (this.config.cacheEnabled) {
        const cacheKey = this.generateCacheKey('tts', text, language);
        const cached = await databaseManager.cacheGet(cacheKey);
        if (cached) {
          return Buffer.from(cached.audio, 'base64');
        }
      }

      const voiceName = this.supportedLanguages[language]?.voice || 'en-US-Wavenet-D';
      
      const request = {
        input: { text },
        voice: {
          languageCode: language,
          name: voiceName,
          ssmlGender: options.gender || 'NEUTRAL'
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: options.speakingRate || 1.0,
          pitch: options.pitch || 0.0,
          volumeGainDb: options.volumeGain || 0.0,
          effectsProfileId: options.effectsProfile || ['telephony-class-application']
        }
      };

      const [response] = await this.ttsClient.synthesizeSpeech(request);
      
      if (!response.audioContent) {
        throw new Error('语音合成未返回音频内容');
      }

      const audioBuffer = Buffer.from(response.audioContent);

      // 缓存结果
      if (this.config.cacheEnabled) {
        const cacheKey = this.generateCacheKey('tts', text, language);
        await databaseManager.cacheSet(cacheKey, { 
          audio: audioBuffer.toString('base64') 
        }, this.config.cacheTTL);
      }

      return audioBuffer;
    } catch (error) {
      console.error('文本转语音失败:', error);
      throw new Error(`语音合成失败: ${error.message}`);
    }
  }

  // 生成缓存键
  generateCacheKey(type, content, language) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    
    if (Buffer.isBuffer(content)) {
      hash.update(content);
    } else {
      hash.update(content.toString());
    }
    
    hash.update(language);
    return `voice_${type}:${hash.digest('hex')}`;
  }

  // 缓存翻译结果
  async cacheTranslationResult(audioBuffer, sourceLanguage, targetLanguage, result) {
    try {
      const cacheKey = this.generateCacheKey('full_translation', audioBuffer, `${sourceLanguage}-${targetLanguage}`);
      await databaseManager.cacheSet(cacheKey, result, this.config.cacheTTL);
    } catch (error) {
      console.error('缓存翻译结果失败:', error);
    }
  }

  // 更新统计数据
  async updateStats(sourceLanguage, targetLanguage, processingTime, qualityScore, success) {
    try {
      this.stats.totalTranslations++;
      
      if (success) {
        this.stats.successfulTranslations++;
      } else {
        this.stats.failedTranslations++;
      }

      // 更新平均处理时间
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * (this.stats.totalTranslations - 1) + processingTime) / 
        this.stats.totalTranslations;

      // 更新语言使用统计
      const langPair = `${sourceLanguage}-${targetLanguage}`;
      this.stats.languageUsage[langPair] = (this.stats.languageUsage[langPair] || 0) + 1;

      // 更新质量分数
      if (qualityScore > 0) {
        this.stats.qualityScores.push(qualityScore);
        
        // 保持最近1000个质量分数
        if (this.stats.qualityScores.length > 1000) {
          this.stats.qualityScores.shift();
        }
      }

      // 保存统计数据
      await this.saveStats();
    } catch (error) {
      console.error('更新统计数据失败:', error);
    }
  }

  // 保存统计数据
  async saveStats() {
    try {
      await databaseManager.cacheSet('voice_translation_stats', this.stats, 86400); // 24小时
    } catch (error) {
      console.error('保存统计数据失败:', error);
    }
  }

  // 加载统计数据
  async loadStats() {
    try {
      const savedStats = await databaseManager.cacheGet('voice_translation_stats');
      if (savedStats) {
        this.stats = { ...this.stats, ...savedStats };
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }

  // 公共API：语音翻译
  async translateVoice(audioBuffer, sourceLanguage, targetLanguage, options = {}) {
    return new Promise((resolve, reject) => {
      // 验证输入
      if (!Buffer.isBuffer(audioBuffer)) {
        return reject(new Error('音频数据必须是Buffer类型'));
      }

      if (audioBuffer.length > this.config.maxFileSize) {
        return reject(new Error(`音频文件过大，最大支持 ${this.config.maxFileSize / 1024 / 1024}MB`));
      }

      if (!this.supportedLanguages[sourceLanguage]) {
        return reject(new Error(`不支持的源语言: ${sourceLanguage}`));
      }

      if (!this.supportedLanguages[targetLanguage]) {
        return reject(new Error(`不支持的目标语言: ${targetLanguage}`));
      }

      // 检查完整翻译缓存
      if (this.config.cacheEnabled) {
        const cacheKey = this.generateCacheKey('full_translation', audioBuffer, `${sourceLanguage}-${targetLanguage}`);
        databaseManager.cacheGet(cacheKey)
          .then(cached => {
            if (cached) {
              this.emit('cacheHit', { sourceLanguage, targetLanguage });
              return resolve({
                ...cached,
                fromCache: true,
                timestamp: new Date()
              });
            }

            // 添加到处理队列
            this.processingQueue.push({
              params: { audioBuffer, sourceLanguage, targetLanguage, options },
              resolve,
              reject
            });
          })
          .catch(() => {
            // 缓存检查失败，直接添加到队列
            this.processingQueue.push({
              params: { audioBuffer, sourceLanguage, targetLanguage, options },
              resolve,
              reject
            });
          });
      } else {
        // 添加到处理队列
        this.processingQueue.push({
          params: { audioBuffer, sourceLanguage, targetLanguage, options },
          resolve,
          reject
        });
      }
    });
  }

  // 获取支持的语言列表
  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  // 获取统计数据
  getStats() {
    const avgQuality = this.stats.qualityScores.length > 0 
      ? this.stats.qualityScores.reduce((a, b) => a + b, 0) / this.stats.qualityScores.length 
      : 0;

    return {
      ...this.stats,
      averageQualityScore: avgQuality,
      successRate: this.stats.totalTranslations > 0 
        ? (this.stats.successfulTranslations / this.stats.totalTranslations * 100).toFixed(2) + '%'
        : '0%',
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing
    };
  }

  // 清除缓存
  async clearCache() {
    try {
      // 这里需要实现清除所有语音翻译相关缓存的逻辑
      console.log('🧹 清除语音翻译缓存');
      return true;
    } catch (error) {
      console.error('清除缓存失败:', error);
      return false;
    }
  }

  // 健康检查
  async healthCheck() {
    try {
      const health = {
        healthy: true,
        services: {},
        stats: this.getStats(),
        timestamp: new Date().toISOString()
      };

      // 检查Google Cloud服务
      try {
        await this.speechClient.getClient();
        health.services.speechToText = { status: 'healthy' };
      } catch (error) {
        health.services.speechToText = { status: 'unhealthy', error: error.message };
        health.healthy = false;
      }

      try {
        await this.ttsClient.getClient();
        health.services.textToSpeech = { status: 'healthy' };
      } catch (error) {
        health.services.textToSpeech = { status: 'unhealthy', error: error.message };
        health.healthy = false;
      }

      try {
        await this.translateClient.getLanguages();
        health.services.translation = { status: 'healthy' };
      } catch (error) {
        health.services.translation = { status: 'unhealthy', error: error.message };
        health.healthy = false;
      }

      return health;
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 创建单例实例
const superVoiceTranslationService = new SuperVoiceTranslationService();

module.exports = {
  SuperVoiceTranslationService,
  superVoiceTranslationService,
  
  // 便捷方法
  translateVoice: (audioBuffer, sourceLanguage, targetLanguage, options) =>
    superVoiceTranslationService.translateVoice(audioBuffer, sourceLanguage, targetLanguage, options),
  
  getSupportedLanguages: () => superVoiceTranslationService.getSupportedLanguages(),
  getVoiceTranslationStats: () => superVoiceTranslationService.getStats(),
  clearVoiceTranslationCache: () => superVoiceTranslationService.clearCache(),
  voiceTranslationHealthCheck: () => superVoiceTranslationService.healthCheck()
};

