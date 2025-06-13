const fs = require('fs').promises;
const path = require('path');

/**
 * 国际化服务类
 * Internationalization Service Class
 */
class I18nService {
    constructor() {
        this.defaultLocale = 'zh';
        this.supportedLocales = ['zh', 'en'];
        this.translations = new Map();
        this.fallbackChain = {
            'zh': ['zh', 'en'],
            'en': ['en', 'zh']
        };
        
        // 初始化翻译数据
        this.initializeTranslations();
    }

    /**
     * 初始化翻译数据
     * Initialize Translation Data
     */
    async initializeTranslations() {
        try {
            for (const locale of this.supportedLocales) {
                const translationPath = path.join(__dirname, '../locales', `${locale}.json`);
                try {
                    const data = await fs.readFile(translationPath, 'utf8');
                    this.translations.set(locale, JSON.parse(data));
                } catch (error) {
                    console.warn(`翻译文件加载失败 / Translation file loading failed: ${locale}.json`);
                    this.translations.set(locale, {});
                }
            }
        } catch (error) {
            console.error('国际化初始化失败 / I18n initialization failed:', error);
        }
    }

    /**
     * 获取翻译文本
     * Get Translation Text
     */
    t(key, locale = this.defaultLocale, params = {}) {
        const fallbackLocales = this.fallbackChain[locale] || [locale, this.defaultLocale];
        
        for (const fallbackLocale of fallbackLocales) {
            const translations = this.translations.get(fallbackLocale);
            if (translations) {
                const translation = this.getNestedValue(translations, key);
                if (translation) {
                    return this.interpolate(translation, params);
                }
            }
        }
        
        // 如果没有找到翻译，返回键名
        console.warn(`翻译缺失 / Missing translation: ${key} for locale: ${locale}`);
        return key;
    }

    /**
     * 获取嵌套对象值
     * Get Nested Object Value
     */
    getNestedValue(obj, key) {
        return key.split('.').reduce((current, keyPart) => {
            return current && current[keyPart] !== undefined ? current[keyPart] : null;
        }, obj);
    }

    /**
     * 插值替换
     * Interpolation
     */
    interpolate(template, params) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    /**
     * 获取双语文本
     * Get Bilingual Text
     */
    getBilingual(key, params = {}) {
        const zh = this.t(key, 'zh', params);
        const en = this.t(key, 'en', params);
        
        if (zh === en) {
            return zh;
        }
        
        return `${zh} / ${en}`;
    }

    /**
     * 检测用户语言偏好
     * Detect User Language Preference
     */
    detectLocale(req) {
        // 1. 检查查询参数
        if (req.query.lang && this.supportedLocales.includes(req.query.lang)) {
            return req.query.lang;
        }
        
        // 2. 检查请求头
        if (req.headers['accept-language']) {
            const acceptedLanguages = req.headers['accept-language']
                .split(',')
                .map(lang => lang.split(';')[0].trim().toLowerCase());
            
            for (const lang of acceptedLanguages) {
                if (this.supportedLocales.includes(lang)) {
                    return lang;
                }
                
                // 检查语言代码的前缀（如 en-US -> en）
                const langPrefix = lang.split('-')[0];
                if (this.supportedLocales.includes(langPrefix)) {
                    return langPrefix;
                }
            }
        }
        
        // 3. 检查用户设置（如果已登录）
        if (req.user && req.user.preferredLanguage) {
            return req.user.preferredLanguage;
        }
        
        // 4. 返回默认语言
        return this.defaultLocale;
    }

    /**
     * 国际化中间件
     * Internationalization Middleware
     */
    middleware() {
        return (req, res, next) => {
            // 检测用户语言偏好
            req.locale = this.detectLocale(req);
            
            // 添加翻译函数到请求对象
            req.t = (key, params = {}) => this.t(key, req.locale, params);
            req.getBilingual = (key, params = {}) => this.getBilingual(key, params);
            
            // 添加翻译函数到响应对象
            res.locals.t = req.t;
            res.locals.getBilingual = req.getBilingual;
            res.locals.locale = req.locale;
            
            next();
        };
    }

    /**
     * 格式化API响应
     * Format API Response
     */
    formatResponse(success, messageKey, data = null, locale = this.defaultLocale, params = {}) {
        const message = this.getBilingual(messageKey, params);
        
        const response = {
            success,
            message,
            locale,
            timestamp: new Date().toISOString()
        };
        
        if (data !== null) {
            response.data = data;
        }
        
        return response;
    }

    /**
     * 格式化错误响应
     * Format Error Response
     */
    formatErrorResponse(errorKey, statusCode = 500, locale = this.defaultLocale, params = {}) {
        return {
            success: false,
            error: {
                code: statusCode,
                message: this.getBilingual(errorKey, params),
                timestamp: new Date().toISOString()
            },
            locale
        };
    }

    /**
     * 获取所有支持的语言
     * Get All Supported Languages
     */
    getSupportedLanguages() {
        return this.supportedLocales.map(locale => ({
            code: locale,
            name: this.t('language.name', locale),
            nativeName: this.t('language.nativeName', locale)
        }));
    }

    /**
     * 添加翻译
     * Add Translation
     */
    addTranslation(locale, key, value) {
        if (!this.translations.has(locale)) {
            this.translations.set(locale, {});
        }
        
        const translations = this.translations.get(locale);
        this.setNestedValue(translations, key, value);
    }

    /**
     * 设置嵌套对象值
     * Set Nested Object Value
     */
    setNestedValue(obj, key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        
        const target = keys.reduce((current, keyPart) => {
            if (!current[keyPart]) {
                current[keyPart] = {};
            }
            return current[keyPart];
        }, obj);
        
        target[lastKey] = value;
    }

    /**
     * 保存翻译到文件
     * Save Translations to File
     */
    async saveTranslations(locale) {
        try {
            const translationPath = path.join(__dirname, '../locales', `${locale}.json`);
            const translations = this.translations.get(locale) || {};
            
            await fs.writeFile(
                translationPath, 
                JSON.stringify(translations, null, 2), 
                'utf8'
            );
            
            console.log(`翻译文件已保存 / Translation file saved: ${locale}.json`);
        } catch (error) {
            console.error(`翻译文件保存失败 / Translation file save failed: ${locale}`, error);
        }
    }

    /**
     * 获取缺失的翻译
     * Get Missing Translations
     */
    getMissingTranslations(sourceLocale = 'zh', targetLocale = 'en') {
        const sourceTranslations = this.translations.get(sourceLocale) || {};
        const targetTranslations = this.translations.get(targetLocale) || {};
        
        const missing = [];
        
        const checkMissing = (sourceObj, targetObj, prefix = '') => {
            for (const [key, value] of Object.entries(sourceObj)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                
                if (typeof value === 'object' && value !== null) {
                    checkMissing(value, targetObj[key] || {}, fullKey);
                } else {
                    if (!targetObj[key]) {
                        missing.push({
                            key: fullKey,
                            sourceText: value,
                            targetText: null
                        });
                    }
                }
            }
        };
        
        checkMissing(sourceTranslations, targetTranslations);
        return missing;
    }

    /**
     * 格式化日期时间
     * Format DateTime
     */
    formatDateTime(date, locale = this.defaultLocale, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        const formatOptions = { ...defaultOptions, ...options };
        
        try {
            return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', formatOptions)
                .format(new Date(date));
        } catch (error) {
            return new Date(date).toISOString();
        }
    }

    /**
     * 格式化数字
     * Format Number
     */
    formatNumber(number, locale = this.defaultLocale, options = {}) {
        try {
            return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', options)
                .format(number);
        } catch (error) {
            return number.toString();
        }
    }

    /**
     * 格式化货币
     * Format Currency
     */
    formatCurrency(amount, currency = 'USD', locale = this.defaultLocale) {
        try {
            return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
                style: 'currency',
                currency: currency
            }).format(amount);
        } catch (error) {
            return `${amount} ${currency}`;
        }
    }

    /**
     * 获取相对时间
     * Get Relative Time
     */
    getRelativeTime(date, locale = this.defaultLocale) {
        const now = new Date();
        const targetDate = new Date(date);
        const diffInSeconds = Math.floor((now - targetDate) / 1000);
        
        const timeUnits = [
            { unit: 'year', seconds: 31536000 },
            { unit: 'month', seconds: 2592000 },
            { unit: 'week', seconds: 604800 },
            { unit: 'day', seconds: 86400 },
            { unit: 'hour', seconds: 3600 },
            { unit: 'minute', seconds: 60 },
            { unit: 'second', seconds: 1 }
        ];
        
        for (const { unit, seconds } of timeUnits) {
            const interval = Math.floor(diffInSeconds / seconds);
            if (interval >= 1) {
                return this.t(`time.${unit}${interval === 1 ? '' : 's'}_ago`, locale, { count: interval });
            }
        }
        
        return this.t('time.just_now', locale);
    }

    /**
     * 验证翻译完整性
     * Validate Translation Completeness
     */
    validateTranslations() {
        const report = {
            total: 0,
            complete: 0,
            missing: {},
            coverage: {}
        };
        
        for (const locale of this.supportedLocales) {
            const missing = this.getMissingTranslations(this.defaultLocale, locale);
            report.missing[locale] = missing;
            
            const totalKeys = this.countKeys(this.translations.get(this.defaultLocale) || {});
            const missingCount = missing.length;
            const completeCount = totalKeys - missingCount;
            
            report.coverage[locale] = {
                total: totalKeys,
                complete: completeCount,
                missing: missingCount,
                percentage: totalKeys > 0 ? Math.round((completeCount / totalKeys) * 100) : 0
            };
        }
        
        return report;
    }

    /**
     * 计算键的数量
     * Count Keys
     */
    countKeys(obj, count = 0) {
        for (const value of Object.values(obj)) {
            if (typeof value === 'object' && value !== null) {
                count = this.countKeys(value, count);
            } else {
                count++;
            }
        }
        return count;
    }
}

module.exports = I18nService;

