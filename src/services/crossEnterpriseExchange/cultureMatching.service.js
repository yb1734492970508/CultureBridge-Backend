/**
 * 企业文化匹配与推荐服务
 * 实现基于AI的企业文化匹配和资源推荐功能
 */

const mongoose = require('mongoose');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

/**
 * 企业文化匹配服务类
 */
class CultureMatchingService {
  /**
   * 推荐匹配企业
   * @param {String} enterpriseId 企业ID
   * @param {Object} options 选项
   * @returns {Promise<Object>} 推荐结果
   */
  async recommendEnterprises(enterpriseId, options = {}) {
    try {
      // 获取企业信息
      const enterprise = await mongoose.model('Enterprise').findOne({ code: enterpriseId });
      
      if (!enterprise) {
        throw new Error('企业不存在');
      }
      
      // 设置默认选项
      const limit = options.limit || 10;
      const minCompatibility = options.minCompatibility || 50;
      
      // 获取所有其他企业
      const otherEnterprises = await mongoose.model('Enterprise').find({
        code: { $ne: enterpriseId },
        'verification.isVerified': true
      });
      
      // 计算文化兼容性
      const compatibilityResults = [];
      
      for (const otherEnterprise of otherEnterprises) {
        const compatibility = await this._calculateCulturalCompatibility(enterprise, otherEnterprise);
        
        if (compatibility.score >= minCompatibility) {
          compatibilityResults.push({
            enterpriseId: otherEnterprise.code,
            name: otherEnterprise.name,
            description: otherEnterprise.description,
            type: otherEnterprise.type,
            location: otherEnterprise.location,
            cultureDomains: otherEnterprise.culture.domains,
            compatibility: compatibility.score,
            compatibilityDetails: compatibility.details
          });
        }
      }
      
      // 按兼容性得分排序
      compatibilityResults.sort((a, b) => b.compatibility - a.compatibility);
      
      // 限制结果数量
      const limitedResults = compatibilityResults.slice(0, limit);
      
      // 记录推荐事件
      await this._logMatchingEvent(enterpriseId, 'enterprise_recommendation', {
        recommendationCount: limitedResults.length,
        options
      });
      
      return {
        success: true,
        recommendations: limitedResults,
        totalMatches: compatibilityResults.length
      };
    } catch (error) {
      console.error('推荐企业失败:', error);
      return {
        success: false,
        error: error.message || '推荐企业时发生未知错误'
      };
    }
  }

  /**
   * 推荐资源
   * @param {String} enterpriseId 企业ID
   * @param {Object} options 选项
   * @returns {Promise<Object>} 推荐结果
   */
  async recommendResources(enterpriseId, options = {}) {
    try {
      // 获取企业信息
      const enterprise = await mongoose.model('Enterprise').findOne({ code: enterpriseId });
      
      if (!enterprise) {
        throw new Error('企业不存在');
      }
      
      // 设置默认选项
      const limit = options.limit || 10;
      const resourceTypes = options.types || [];
      
      // 获取企业文化画像
      const profile = await this.generateCultureProfile(enterpriseId);
      
      if (!profile.success) {
        throw new Error('生成文化画像失败');
      }
      
      // 获取所有公开资源
      let resourceQuery = {
        status: 'active',
        $or: [
          { 'permissions.visibility': 'public' },
          { 'permissions.allowedEnterprises': enterpriseId },
          { enterpriseId }
        ]
      };
      
      // 如果指定了资源类型，添加到查询条件
      if (resourceTypes.length > 0) {
        resourceQuery.type = { $in: resourceTypes };
      }
      
      const resources = await mongoose.model('Resource').find(resourceQuery);
      
      // 计算资源与企业文化的相关性
      const relevanceResults = [];
      
      for (const resource of resources) {
        const relevance = await this._calculateResourceRelevance(resource, profile.profile);
        
        relevanceResults.push({
          resourceId: resource.resourceId,
          title: resource.title,
          description: resource.description,
          type: resource.type,
          tags: resource.tags,
          enterpriseId: resource.enterpriseId,
          relevance: relevance.score,
          relevanceDetails: relevance.details
        });
      }
      
      // 按相关性得分排序
      relevanceResults.sort((a, b) => b.relevance - a.relevance);
      
      // 限制结果数量
      const limitedResults = relevanceResults.slice(0, limit);
      
      // 记录推荐事件
      await this._logMatchingEvent(enterpriseId, 'resource_recommendation', {
        recommendationCount: limitedResults.length,
        options
      });
      
      return {
        success: true,
        recommendations: limitedResults,
        totalMatches: relevanceResults.length
      };
    } catch (error) {
      console.error('推荐资源失败:', error);
      return {
        success: false,
        error: error.message || '推荐资源时发生未知错误'
      };
    }
  }

  /**
   * 生成企业文化画像
   * @param {String} enterpriseId 企业ID
   * @returns {Promise<Object>} 文化画像
   */
  async generateCultureProfile(enterpriseId) {
    try {
      // 获取企业信息
      const enterprise = await mongoose.model('Enterprise').findOne({ code: enterpriseId });
      
      if (!enterprise) {
        throw new Error('企业不存在');
      }
      
      // 获取企业资源
      const resources = await mongoose.model('Resource').find({
        enterpriseId,
        status: 'active'
      });
      
      // 获取企业项目
      const projects = await mongoose.model('Project').find({
        ownerEnterpriseId: enterpriseId
      });
      
      // 提取关键词
      const keywords = new Set();
      
      // 从企业文化标签中提取
      if (enterprise.culture && enterprise.culture.tags) {
        enterprise.culture.tags.forEach(tag => keywords.add(tag));
      }
      
      // 从资源标签中提取
      resources.forEach(resource => {
        if (resource.tags) {
          resource.tags.forEach(tag => keywords.add(tag));
        }
      });
      
      // 从项目标签中提取
      projects.forEach(project => {
        if (project.tags) {
          project.tags.forEach(tag => keywords.add(tag));
        }
      });
      
      // 从企业描述中提取
      if (enterprise.description) {
        const tokens = tokenizer.tokenize(enterprise.description);
        tokens.forEach(token => {
          if (token.length > 3) {
            keywords.add(token);
          }
        });
      }
      
      // 构建文化画像
      const profile = {
        enterpriseId: enterprise.code,
        name: enterprise.name,
        type: enterprise.type,
        cultureDomains: enterprise.culture ? enterprise.culture.domains : [],
        keywords: Array.from(keywords),
        resourceCount: resources.length,
        projectCount: projects.length,
        collaborationPreferences: enterprise.settings ? enterprise.settings.collaborationPreferences : {},
        generatedAt: new Date()
      };
      
      // 记录画像生成事件
      await this._logMatchingEvent(enterpriseId, 'profile_generation', {
        keywordCount: profile.keywords.length
      });
      
      return {
        success: true,
        profile
      };
    } catch (error) {
      console.error('生成文化画像失败:', error);
      return {
        success: false,
        error: error.message || '生成文化画像时发生未知错误'
      };
    }
  }

  /**
   * 基于项目推荐企业
   * @param {String} projectId 项目ID
   * @param {Object} options 选项
   * @returns {Promise<Object>} 推荐结果
   */
  async recommendEnterprisesByProject(projectId, options = {}) {
    try {
      // 获取项目信息 - 使用projectId字符串查询
      const project = await mongoose.model('Project').findOne({ projectId });
      
      if (!project) {
        throw new Error('项目不存在');
      }
      
      // 设置默认选项
      const limit = options.limit || 5;
      
      // 获取项目创建者企业
      const creatorEnterprise = await mongoose.model('Enterprise').findOne({
        code: project.ownerEnterpriseId
      });
      
      if (!creatorEnterprise) {
        throw new Error('创建者企业不存在');
      }
      
      // 获取所有其他企业
      const otherEnterprises = await mongoose.model('Enterprise').find({
        code: { $ne: project.ownerEnterpriseId },
        'verification.isVerified': true
      });
      
      // 计算项目与企业的匹配度
      const matchResults = [];
      
      for (const otherEnterprise of otherEnterprises) {
        const match = await this._calculateProjectEnterpriseMatch(project, otherEnterprise);
        
        matchResults.push({
          enterpriseId: otherEnterprise.code,
          name: otherEnterprise.name,
          description: otherEnterprise.description,
          type: otherEnterprise.type,
          location: otherEnterprise.location,
          cultureDomains: otherEnterprise.culture.domains,
          matchScore: match.score,
          matchDetails: match.details
        });
      }
      
      // 按匹配度排序
      matchResults.sort((a, b) => b.matchScore - a.matchScore);
      
      // 限制结果数量
      const limitedResults = matchResults.slice(0, limit);
      
      // 记录推荐事件
      await this._logMatchingEvent(project.ownerEnterpriseId, 'project_enterprise_recommendation', {
        projectId,
        recommendationCount: limitedResults.length
      });
      
      return {
        success: true,
        recommendations: limitedResults,
        totalMatches: matchResults.length
      };
    } catch (error) {
      console.error('基于项目推荐企业失败:', error);
      return {
        success: false,
        error: error.message || '基于项目推荐企业时发生未知错误'
      };
    }
  }

  /**
   * 基于文化画像生成战略建议
   * @param {Object} profile 文化画像
   * @returns {Promise<Object>} 战略建议
   */
  async generateStrategicRecommendationsByProfile(profile) {
    try {
      // 基于文化画像生成战略建议
      const recommendations = {
        collaborationOpportunities: [
          {
            type: '跨领域合作',
            description: '建议与' + this._getComplementaryDomains(profile.cultureDomains).join('、') + '等领域的企业开展合作，拓展文化视野'
          },
          {
            type: '资源共享',
            description: '基于企业现有资源特点，建议重点共享高质量的' + this._getResourceTypesByDomains(profile.cultureDomains).join('、') + '等资源类型'
          }
        ],
        developmentDirections: [
          {
            type: '文化资产扩展',
            description: '建议拓展' + this._getGrowthDirections(profile).join('、') + '等方向的文化资产'
          },
          {
            type: '技术应用',
            description: '建议应用' + this._getTechRecommendations(profile).join('、') + '等技术提升文化资产价值'
          }
        ],
        marketingStrategies: [
          {
            type: '目标受众',
            description: '基于企业文化特点，建议重点关注' + this._getTargetAudiences(profile).join('、') + '等受众群体'
          },
          {
            type: '传播渠道',
            description: '建议通过' + this._getMarketingChannels(profile).join('、') + '等渠道进行文化传播'
          }
        ]
      };
      
      return {
        success: true,
        recommendations
      };
    } catch (error) {
      console.error('基于文化画像生成战略建议失败:', error);
      return {
        success: false,
        error: error.message || '基于文化画像生成战略建议时发生未知错误'
      };
    }
  }

  // 以下是私有辅助方法

  /**
   * 计算企业文化兼容性
   * @private
   * @param {Object} enterprise1 企业1
   * @param {Object} enterprise2 企业2
   * @returns {Promise<Object>} 兼容性结果
   */
  async _calculateCulturalCompatibility(enterprise1, enterprise2) {
    // 计算文化领域重叠度
    const domains1 = enterprise1.culture ? enterprise1.culture.domains : [];
    const domains2 = enterprise2.culture ? enterprise2.culture.domains : [];
    
    const domainOverlap = domains1.filter(domain => domains2.includes(domain)).length;
    const maxDomains = Math.max(domains1.length, domains2.length);
    const domainScore = maxDomains > 0 ? (domainOverlap / maxDomains) * 40 : 0;
    
    // 计算文化标签重叠度
    const tags1 = enterprise1.culture ? enterprise1.culture.tags : [];
    const tags2 = enterprise2.culture ? enterprise2.culture.tags : [];
    
    const tagOverlap = tags1.filter(tag => tags2.includes(tag)).length;
    const maxTags = Math.max(tags1.length, tags2.length);
    const tagScore = maxTags > 0 ? (tagOverlap / maxTags) * 30 : 0;
    
    // 计算协作偏好重叠度
    let prefOverlap = 0;
    let maxPrefs = 0;
    let prefScore = 0;
    
    if (enterprise1.settings && enterprise1.settings.collaborationPreferences &&
        enterprise2.settings && enterprise2.settings.collaborationPreferences) {
      const prefs1 = enterprise1.settings.collaborationPreferences.preferredCollaborationTypes || [];
      const prefs2 = enterprise2.settings.collaborationPreferences.preferredCollaborationTypes || [];
      
      prefOverlap = prefs1.filter(pref => prefs2.includes(pref)).length;
      maxPrefs = Math.max(prefs1.length, prefs2.length);
      prefScore = maxPrefs > 0 ? (prefOverlap / maxPrefs) * 30 : 0;
    }
    
    // 计算总兼容性得分
    const compatibilityScore = domainScore + tagScore + prefScore;
    
    return {
      score: Math.round(compatibilityScore),
      details: {
        domainOverlap,
        tagOverlap,
        prefOverlap,
        domainScore,
        tagScore,
        prefScore
      }
    };
  }

  /**
   * 计算资源与企业文化的相关性
   * @private
   * @param {Object} resource 资源
   * @param {Object} profile 企业文化画像
   * @returns {Promise<Object>} 相关性结果
   */
  async _calculateResourceRelevance(resource, profile) {
    // 计算领域匹配度
    let domainScore = 0;
    if (resource.type) {
      const resourceDomain = this._mapResourceTypeToDomain(resource.type);
      if (profile.cultureDomains.includes(resourceDomain)) {
        domainScore = 40;
      }
    }
    
    // 计算标签匹配度
    const resourceTags = resource.tags || [];
    const profileKeywords = profile.keywords || [];
    
    const tagOverlap = resourceTags.filter(tag => profileKeywords.includes(tag)).length;
    const maxTags = Math.max(resourceTags.length, 1);
    const tagScore = (tagOverlap / maxTags) * 40;
    
    // 计算协作偏好匹配度
    let prefScore = 0;
    if (profile.collaborationPreferences && profile.collaborationPreferences.preferredCollaborationTypes) {
      const resourceCollabType = this._mapResourceTypeToCollabType(resource.type);
      if (profile.collaborationPreferences.preferredCollaborationTypes.includes(resourceCollabType)) {
        prefScore = 20;
      }
    }
    
    // 计算总相关性得分
    const relevanceScore = domainScore + tagScore + prefScore;
    
    return {
      score: Math.round(relevanceScore),
      details: {
        domainScore,
        tagScore,
        prefScore
      }
    };
  }

  /**
   * 计算项目与企业的匹配度
   * @private
   * @param {Object} project 项目
   * @param {Object} enterprise 企业
   * @returns {Promise<Object>} 匹配结果
   */
  async _calculateProjectEnterpriseMatch(project, enterprise) {
    // 计算项目类型与企业领域的匹配度
    let domainScore = 0;
    const projectDomain = this._mapProjectTypeToDomain(project.type);
    const enterpriseDomains = enterprise.culture ? enterprise.culture.domains : [];
    
    if (enterpriseDomains.includes(projectDomain)) {
      domainScore = 40;
    }
    
    // 计算标签匹配度
    const projectTags = project.tags || [];
    const enterpriseTags = enterprise.culture ? enterprise.culture.tags : [];
    
    const tagOverlap = projectTags.filter(tag => enterpriseTags.includes(tag)).length;
    const maxTags = Math.max(projectTags.length, 1);
    const tagScore = (tagOverlap / maxTags) * 40;
    
    // 计算协作偏好匹配度
    let prefScore = 0;
    if (enterprise.settings && enterprise.settings.collaborationPreferences) {
      const projectCollabType = this._mapProjectTypeToCollabType(project.type);
      const enterprisePrefs = enterprise.settings.collaborationPreferences.preferredCollaborationTypes || [];
      
      if (enterprisePrefs.includes(projectCollabType)) {
        prefScore = 20;
      }
    }
    
    // 计算总匹配度得分
    const matchScore = domainScore + tagScore + prefScore;
    
    return {
      score: Math.round(matchScore),
      details: {
        domainScore,
        tagScore,
        prefScore
      }
    };
  }

  /**
   * 记录匹配事件
   * @private
   * @param {String} enterpriseId 企业ID
   * @param {String} eventType 事件类型
   * @param {Object} details 事件详情
   * @returns {Promise<void>}
   */
  async _logMatchingEvent(enterpriseId, eventType, details = {}) {
    try {
      // 在实际实现中，这里会记录事件到数据库
      console.log(`匹配事件: ${eventType}, 企业ID: ${enterpriseId}`);
    } catch (error) {
      console.error('记录匹配事件失败:', error);
      // 不抛出异常，避免影响主流程
    }
  }

  /**
   * 将资源类型映射到文化领域
   * @private
   * @param {String} resourceType 资源类型
   * @returns {String} 文化领域
   */
  _mapResourceTypeToDomain(resourceType) {
    const mapping = {
      'image_collection': 'visual_arts',
      'video_collection': 'digital_media',
      'audio_collection': 'music',
      'text_collection': 'literature',
      'digital_collection': 'digital_media',
      'knowledge_base': 'heritage',
      'design_assets': 'design',
      'performance_recording': 'performing_arts',
      'interactive_content': 'digital_media',
      'educational_material': 'heritage'
    };
    
    return mapping[resourceType] || 'other';
  }

  /**
   * 将资源类型映射到协作类型
   * @private
   * @param {String} resourceType 资源类型
   * @returns {String} 协作类型
   */
  _mapResourceTypeToCollabType(resourceType) {
    const mapping = {
      'image_collection': 'content_sharing',
      'video_collection': 'content_sharing',
      'audio_collection': 'content_sharing',
      'text_collection': 'knowledge_sharing',
      'digital_collection': 'digital_collaboration',
      'knowledge_base': 'knowledge_sharing',
      'design_assets': 'creative_collaboration',
      'performance_recording': 'content_sharing',
      'interactive_content': 'digital_collaboration',
      'educational_material': 'knowledge_sharing'
    };
    
    return mapping[resourceType] || 'general_collaboration';
  }

  /**
   * 将项目类型映射到文化领域
   * @private
   * @param {String} projectType 项目类型
   * @returns {String} 文化领域
   */
  _mapProjectTypeToDomain(projectType) {
    const mapping = {
      'cultural_exchange': 'heritage',
      'collaborative_creation': 'visual_arts',
      'research': 'heritage',
      'exhibition': 'visual_arts',
      'education': 'heritage',
      'preservation': 'heritage'
    };
    
    return mapping[projectType] || 'other';
  }

  /**
   * 将项目类型映射到协作类型
   * @private
   * @param {String} projectType 项目类型
   * @returns {String} 协作类型
   */
  _mapProjectTypeToCollabType(projectType) {
    const mapping = {
      'cultural_exchange': 'cultural_exchange',
      'collaborative_creation': 'creative_collaboration',
      'research': 'knowledge_sharing',
      'exhibition': 'content_sharing',
      'education': 'knowledge_sharing',
      'preservation': 'cultural_exchange'
    };
    
    return mapping[projectType] || 'general_collaboration';
  }

  /**
   * 获取互补文化领域
   * @private
   * @param {Array} domains 文化领域
   * @returns {Array} 互补领域
   */
  _getComplementaryDomains(domains) {
    const allDomains = [
      'visual_arts', 'performing_arts', 'literature', 'music', 
      'film', 'digital_media', 'heritage', 'crafts', 
      'design', 'fashion', 'architecture', 'culinary'
    ];
    
    // 过滤出不在当前领域中的领域
    const complementary = allDomains.filter(domain => !domains.includes(domain));
    
    // 返回前3个互补领域
    return complementary.slice(0, 3);
  }

  /**
   * 根据文化领域获取推荐资源类型
   * @private
   * @param {Array} domains 文化领域
   * @returns {Array} 资源类型
   */
  _getResourceTypesByDomains(domains) {
    const resourceTypes = [];
    
    if (domains.includes('visual_arts')) {
      resourceTypes.push('高清图像');
    }
    
    if (domains.includes('performing_arts')) {
      resourceTypes.push('表演视频');
    }
    
    if (domains.includes('music')) {
      resourceTypes.push('音频资源');
    }
    
    if (domains.includes('literature')) {
      resourceTypes.push('文本资料');
    }
    
    if (domains.includes('heritage')) {
      resourceTypes.push('文化遗产数据');
    }
    
    if (domains.includes('digital_media')) {
      resourceTypes.push('数字媒体资源');
    }
    
    // 如果没有匹配到任何类型，返回默认类型
    if (resourceTypes.length === 0) {
      return ['数字化文化资源', '多媒体内容', '知识库'];
    }
    
    return resourceTypes;
  }

  /**
   * 获取增长方向建议
   * @private
   * @param {Object} profile 文化画像
   * @returns {Array} 增长方向
   */
  _getGrowthDirections(profile) {
    const directions = [];
    const domains = profile.cultureDomains || [];
    
    if (domains.includes('visual_arts') || domains.includes('design')) {
      directions.push('数字艺术创作');
    }
    
    if (domains.includes('heritage') || domains.includes('literature')) {
      directions.push('文化知识图谱');
    }
    
    if (domains.includes('performing_arts') || domains.includes('music')) {
      directions.push('沉浸式体验');
    }
    
    if (domains.includes('digital_media') || domains.includes('film')) {
      directions.push('交互式内容');
    }
    
    // 如果没有匹配到任何方向，返回默认方向
    if (directions.length === 0) {
      return ['跨文化合作项目', '数字化转型', '创新表达形式'];
    }
    
    return directions;
  }

  /**
   * 获取技术应用建议
   * @private
   * @param {Object} profile 文化画像
   * @returns {Array} 技术应用
   */
  _getTechRecommendations(profile) {
    const techs = [];
    const domains = profile.cultureDomains || [];
    
    if (domains.includes('visual_arts') || domains.includes('design') || domains.includes('film')) {
      techs.push('AR/VR技术');
    }
    
    if (domains.includes('heritage') || domains.includes('literature')) {
      techs.push('知识图谱');
    }
    
    if (domains.includes('music') || domains.includes('performing_arts')) {
      techs.push('空间音频');
    }
    
    if (domains.includes('digital_media')) {
      techs.push('人工智能创作');
    }
    
    // 如果没有匹配到任何技术，返回默认技术
    if (techs.length === 0) {
      return ['区块链认证', '人工智能分析', '云端协作平台'];
    }
    
    return techs;
  }

  /**
   * 获取目标受众建议
   * @private
   * @param {Object} profile 文化画像
   * @returns {Array} 目标受众
   */
  _getTargetAudiences(profile) {
    const audiences = [];
    const domains = profile.cultureDomains || [];
    
    if (domains.includes('heritage') || domains.includes('literature')) {
      audiences.push('文化研究者');
    }
    
    if (domains.includes('design') || domains.includes('fashion')) {
      audiences.push('设计师群体');
    }
    
    if (domains.includes('performing_arts') || domains.includes('music')) {
      audiences.push('艺术爱好者');
    }
    
    if (domains.includes('digital_media') || domains.includes('film')) {
      audiences.push('数字原住民');
    }
    
    // 如果没有匹配到任何受众，返回默认受众
    if (audiences.length === 0) {
      return ['文化机构', '教育机构', '创意产业从业者'];
    }
    
    return audiences;
  }

  /**
   * 获取营销渠道建议
   * @private
   * @param {Object} profile 文化画像
   * @returns {Array} 营销渠道
   */
  _getMarketingChannels(profile) {
    const channels = [];
    const domains = profile.cultureDomains || [];
    
    if (domains.includes('digital_media') || domains.includes('film')) {
      channels.push('短视频平台');
    }
    
    if (domains.includes('visual_arts') || domains.includes('design')) {
      channels.push('图像社交媒体');
    }
    
    if (domains.includes('heritage') || domains.includes('literature')) {
      channels.push('专业学术平台');
    }
    
    if (domains.includes('performing_arts') || domains.includes('music')) {
      channels.push('线下体验活动');
    }
    
    // 如果没有匹配到任何渠道，返回默认渠道
    if (channels.length === 0) {
      channels.push('文化交流平台', '行业展会', '专业社群');
    }
    
    return channels;
  }
}

module.exports = CultureMatchingService;
