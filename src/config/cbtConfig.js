// CBT代币价格和经济模型配置
const CBT_CONFIG = {
    // 代币基本信息
    TOKEN_INFO: {
        name: 'CultureBridge Token',
        symbol: 'CBT',
        decimals: 18,
        totalSupply: '1000000000', // 10亿代币
        initialPrice: 0.05, // $0.05 USD
        website: 'https://culturebridgechain.com'
    },
    
    // 代币分配
    TOKEN_ALLOCATION: {
        ECOSYSTEM_REWARDS: 0.40, // 40% - 生态奖励
        TEAM: 0.15, // 15% - 团队
        INVESTORS: 0.20, // 20% - 投资者
        LIQUIDITY: 0.10, // 10% - 流动性
        MARKETING: 0.10, // 10% - 营销推广
        RESERVE: 0.05 // 5% - 储备基金
    },
    
    // 价格相关配置
    PRICE_CONFIG: {
        initialPriceUSD: 0.05,
        targetPriceUSD: 1.00, // 目标价格
        priceUpdateInterval: 3600000, // 1小时更新一次价格
        priceVolatilityThreshold: 0.1 // 10%波动阈值
    },
    
    // 奖励价值计算 (基于$0.05价格)
    REWARD_VALUES: {
        REGISTRATION: 1.00, // $1.00
        DAILY_LOGIN: 0.05, // $0.05
        WEEKLY_LOGIN: 0.75, // $0.75
        MONTHLY_LOGIN: 3.50, // $3.50
        POST_CONTENT: 0.25, // $0.25
        VOICE_TRANSLATION: 0.025, // $0.025
        CHAT_MESSAGE: 0.005, // $0.005
        VOICE_CALL_MINUTE: 0.025, // $0.025
        VIDEO_CALL_MINUTE: 0.05, // $0.05
        CULTURAL_EXCHANGE: 0.50, // $0.50
        LANGUAGE_LEARNING: 0.15, // $0.15
        COURSE_COMPLETION: 0.75, // $0.75
        TEST_PASS: 1.25, // $1.25
        REFERRAL: 1.00, // $1.00
        REFERRAL_BONUS: 0.50, // $0.50
        LIKE_RECEIVED: 0.01, // $0.01
        COMMENT_RECEIVED: 0.015 // $0.015
    },
    
    // 通胀控制
    INFLATION_CONTROL: {
        dailyRewardCap: 50, // 每用户每日最多50 CBT
        burnRate: 0.30, // 30%收入用于回购销毁
        stakingAPY: 0.12, // 12%年化收益
        minimumStakingPeriod: 30 // 最少质押30天
    },
    
    // 使用场景定价
    UTILITY_PRICING: {
        PREMIUM_FEATURES: 10, // 10 CBT解锁高级功能
        VIRTUAL_GIFTS: {
            SMALL: 1, // 1 CBT
            MEDIUM: 5, // 5 CBT
            LARGE: 20 // 20 CBT
        },
        PREMIUM_COURSES: 50, // 50 CBT购买专业课程
        NFT_MINTING: 25, // 25 CBT铸造NFT
        GOVERNANCE_VOTING: 100 // 100 CBT参与治理投票
    }
};

module.exports = CBT_CONFIG;

