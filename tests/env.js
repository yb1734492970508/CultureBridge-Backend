// 测试环境变量设置
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.JWT_EXPIRE = '30d';
process.env.JWT_COOKIE_EXPIRE = '30';

// 数据库配置
process.env.MONGO_URI = 'mongodb://localhost:27017/culturebridge_test';

// 区块链测试配置
process.env.BSC_NETWORK = 'testnet';
process.env.BSC_RPC_URL = 'https://data-seed-prebsc-1-s1.binance.org:8545';
process.env.BSC_CHAIN_ID = '97';

// 测试钱包配置
process.env.TEST_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
process.env.ADMIN_PRIVATE_KEY = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

// 合约地址（测试）
process.env.CBT_TOKEN_ADDRESS = '0x1234567890123456789012345678901234567890';
process.env.IDENTITY_CONTRACT_ADDRESS = '0x2345678901234567890123456789012345678901';
process.env.MARKETPLACE_CONTRACT_ADDRESS = '0x3456789012345678901234567890123456789012';

// Google Cloud测试配置
process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
process.env.GOOGLE_CLOUD_KEY_FILE = './tests/mocks/google-cloud-key.json';

// Redis配置
process.env.REDIS_URL = 'redis://localhost:6379/1';

// 加密配置
process.env.ENCRYPTION_KEY = 'test_encryption_key_32_characters_';

// 文件上传配置
process.env.FILE_UPLOAD_PATH = './tests/temp/uploads';
process.env.MAX_FILE_UPLOAD = '10000000'; // 10MB

// 邮件配置（测试）
process.env.SMTP_HOST = 'smtp.mailtrap.io';
process.env.SMTP_PORT = '2525';
process.env.SMTP_EMAIL = 'test@example.com';
process.env.SMTP_PASSWORD = 'test_password';
process.env.FROM_EMAIL = 'noreply@culturebridge.test';
process.env.FROM_NAME = 'CultureBridge Test';

// API限制配置
process.env.RATE_LIMIT_WINDOW = '900000'; // 15分钟
process.env.RATE_LIMIT_MAX = '100'; // 100请求

console.log('✅ 测试环境变量已加载');

