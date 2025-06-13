#!/bin/bash

# CultureBridge 后端部署脚本
# 版本: 2.0.0
# 更新日期: 2025-06-13

echo "🚀 开始部署 CultureBridge 后端服务..."

# 检查Node.js版本
echo "📋 检查Node.js版本..."
node_version=$(node -v)
echo "当前Node.js版本: $node_version"

# 检查npm版本
npm_version=$(npm -v)
echo "当前npm版本: $npm_version"

# 安装依赖
echo "📦 安装项目依赖..."
npm install

# 检查环境变量
echo "🔧 检查环境变量..."
if [ ! -f .env ]; then
    echo "⚠️  .env文件不存在，创建示例配置..."
    cat > .env << EOF
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://localhost:27017/culturebridge
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE=30d

# BNB链配置
BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
PRIVATE_KEY=your_private_key_here
CBT_CONTRACT_ADDRESS=your_contract_address_here

# 语音翻译服务配置
WHISPER_API_URL=http://localhost:9000/asr
LIBRE_TRANSLATE_URL=https://libretranslate.de/translate
LIBRE_TRANSLATE_API_KEY=your_api_key_here

# Azure服务配置（可选）
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region
AZURE_TRANSLATE_KEY=your_azure_translate_key
AZURE_TRANSLATE_REGION=your_azure_region

# 文件上传配置
MAX_FILE_UPLOAD=50
FILE_UPLOAD_PATH=./uploads

# 邮件服务配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_email_password
FROM_EMAIL=noreply@culturebridge.com
FROM_NAME=CultureBridge

# Redis配置（可选）
REDIS_URL=redis://localhost:6379
EOF
    echo "✅ 已创建 .env 示例文件，请根据实际情况修改配置"
fi

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p uploads/voice
mkdir -p uploads/images
mkdir -p uploads/documents
mkdir -p logs

# 设置文件权限
echo "🔐 设置文件权限..."
chmod 755 uploads
chmod 755 uploads/voice
chmod 755 uploads/images
chmod 755 uploads/documents
chmod 755 logs

# 运行测试（可选）
if [ "$1" = "--test" ]; then
    echo "🧪 运行测试..."
    npm test
    if [ $? -ne 0 ]; then
        echo "❌ 测试失败，停止部署"
        exit 1
    fi
fi

# 构建项目（如果有构建步骤）
echo "🔨 构建项目..."
# npm run build  # 如果有构建步骤，取消注释

# 启动服务
echo "🌟 启动CultureBridge后端服务..."
if [ "$NODE_ENV" = "production" ]; then
    echo "🚀 生产环境启动..."
    npm run start:prod
else
    echo "🔧 开发环境启动..."
    npm run dev
fi

echo "✅ CultureBridge后端服务部署完成！"
echo "🌐 服务地址: http://localhost:${PORT:-5000}"
echo "📚 API文档: http://localhost:${PORT:-5000}/api/v1"
echo "💬 Socket.IO: ws://localhost:${PORT:-5000}"

