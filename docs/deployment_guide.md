# CultureBridge 部署指南

## 环境要求

### 系统要求
- Node.js >= 16.0.0
- MongoDB >= 4.4
- Redis >= 6.0 (可选，用于缓存和消息队列)
- Git

### 云服务要求
- Google Cloud Platform账户 (用于语音翻译服务)
- BNB Smart Chain节点访问 (或使用公共RPC)

## 本地开发环境设置

### 1. 克隆项目
```bash
git clone https://github.com/yb1734492970508/CultureBridge-Backend.git
cd CultureBridge-Backend
```

### 2. 安装依赖
```bash
npm install
```

### 3. 环境配置
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

### 4. 配置Google Cloud服务
1. 在Google Cloud Console创建项目
2. 启用以下API：
   - Cloud Speech-to-Text API
   - Cloud Text-to-Speech API
   - Cloud Translation API
3. 创建服务账户并下载密钥文件
4. 将密钥文件保存为 `config/google-cloud-key.json`

### 5. 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## Docker部署

### 1. 构建Docker镜像
```bash
# 构建镜像
docker build -t culturebridge-backend .

# 运行容器
docker run -d \
  --name culturebridge-backend \
  -p 5000:5000 \
  --env-file .env \
  culturebridge-backend
```

### 2. Docker Compose部署
```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 云平台部署

### AWS部署

#### 使用AWS ECS
1. 创建ECS集群
2. 构建并推送Docker镜像到ECR
3. 创建任务定义
4. 创建服务并部署

```bash
# 登录ECR
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-west-2.amazonaws.com

# 构建并推送镜像
docker build -t culturebridge-backend .
docker tag culturebridge-backend:latest <account-id>.dkr.ecr.us-west-2.amazonaws.com/culturebridge-backend:latest
docker push <account-id>.dkr.ecr.us-west-2.amazonaws.com/culturebridge-backend:latest
```

#### 使用AWS Elastic Beanstalk
1. 安装EB CLI
2. 初始化应用
3. 部署

```bash
# 安装EB CLI
pip install awsebcli

# 初始化
eb init

# 创建环境并部署
eb create production
eb deploy
```

### Google Cloud Platform部署

#### 使用Cloud Run
```bash
# 构建并推送到Container Registry
gcloud builds submit --tag gcr.io/PROJECT-ID/culturebridge-backend

# 部署到Cloud Run
gcloud run deploy culturebridge-backend \
  --image gcr.io/PROJECT-ID/culturebridge-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Azure部署

#### 使用Azure Container Instances
```bash
# 创建资源组
az group create --name culturebridge-rg --location eastus

# 部署容器
az container create \
  --resource-group culturebridge-rg \
  --name culturebridge-backend \
  --image culturebridge-backend:latest \
  --dns-name-label culturebridge-backend \
  --ports 5000
```

## 数据库部署

### MongoDB Atlas (推荐)
1. 创建MongoDB Atlas账户
2. 创建集群
3. 配置网络访问
4. 创建数据库用户
5. 获取连接字符串并更新 `MONGO_URI`

### 自托管MongoDB
```bash
# 使用Docker运行MongoDB
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:latest
```

## 负载均衡和扩展

### Nginx配置
```nginx
upstream culturebridge_backend {
    server 127.0.0.1:5000;
    server 127.0.0.1:5001;
    server 127.0.0.1:5002;
}

server {
    listen 80;
    server_name api.culturebridge.com;

    location / {
        proxy_pass http://culturebridge_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket支持
    location /socket.io/ {
        proxy_pass http://culturebridge_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### PM2进程管理
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 重启应用
pm2 restart all

# 保存配置
pm2 save
pm2 startup
```

## 监控和日志

### 应用监控
```bash
# 使用PM2监控
pm2 monit

# 使用New Relic
npm install newrelic
```

### 日志管理
```bash
# 使用Winston进行日志记录
# 配置日志轮转
npm install winston-daily-rotate-file

# 使用ELK Stack进行日志分析
# Elasticsearch + Logstash + Kibana
```

## 安全配置

### SSL/TLS证书
```bash
# 使用Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.culturebridge.com
```

### 防火墙配置
```bash
# UFW配置
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 环境变量安全
- 使用AWS Secrets Manager或Azure Key Vault
- 不要在代码中硬编码敏感信息
- 定期轮换API密钥和数据库密码

## 备份策略

### 数据库备份
```bash
# MongoDB备份
mongodump --uri="mongodb://username:password@host:port/database" --out=/backup/$(date +%Y%m%d)

# 自动备份脚本
#!/bin/bash
BACKUP_DIR="/backup/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR/$DATE"
tar -czf "$BACKUP_DIR/$DATE.tar.gz" -C "$BACKUP_DIR" "$DATE"
rm -rf "$BACKUP_DIR/$DATE"
```

### 文件备份
```bash
# 上传文件备份到云存储
aws s3 sync ./uploads s3://culturebridge-uploads-backup/$(date +%Y%m%d)/
```

## 性能优化

### 缓存配置
```bash
# Redis配置
redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### CDN配置
- 使用CloudFlare或AWS CloudFront
- 配置静态资源缓存
- 启用Gzip压缩

## 故障排除

### 常见问题

#### 1. 连接数据库失败
```bash
# 检查MongoDB连接
mongo "mongodb://username:password@host:port/database"

# 检查网络连接
telnet host port
```

#### 2. Socket.IO连接问题
```bash
# 检查WebSocket支持
curl -H "Upgrade: websocket" -H "Connection: Upgrade" http://localhost:5000/socket.io/
```

#### 3. 内存不足
```bash
# 检查内存使用
free -h
top -p $(pgrep node)

# 增加swap空间
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 日志分析
```bash
# 查看应用日志
tail -f logs/combined.log

# 查看错误日志
tail -f logs/error.log

# 查看系统日志
journalctl -u culturebridge-backend -f
```

## 维护和更新

### 零停机部署
```bash
# 使用PM2进行零停机部署
pm2 reload ecosystem.config.js

# 使用蓝绿部署
# 1. 部署到新环境
# 2. 测试新环境
# 3. 切换流量
# 4. 关闭旧环境
```

### 数据库迁移
```bash
# 运行数据库迁移
npm run migrate

# 回滚迁移
npm run migrate:rollback
```

这个部署指南涵盖了从本地开发到生产环境的完整部署流程，确保CultureBridge后端系统能够稳定、安全地运行。

