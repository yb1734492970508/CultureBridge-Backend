const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * 加密服务类
 * Encryption Service Class
 */
class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32;
        this.ivLength = 16;
        this.tagLength = 16;
        this.saltLength = 32;
        
        // 从环境变量获取主密钥
        this.masterKey = process.env.MASTER_ENCRYPTION_KEY || this.generateKey();
        
        if (!process.env.MASTER_ENCRYPTION_KEY) {
            console.warn('⚠️ 警告：未设置MASTER_ENCRYPTION_KEY环境变量，使用临时密钥');
        }
    }

    /**
     * 生成随机密钥
     * Generate Random Key
     */
    generateKey() {
        return crypto.randomBytes(this.keyLength).toString('hex');
    }

    /**
     * 生成随机盐值
     * Generate Random Salt
     */
    generateSalt() {
        return crypto.randomBytes(this.saltLength);
    }

    /**
     * 派生密钥
     * Derive Key
     */
    deriveKey(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha512');
    }

    /**
     * 加密数据
     * Encrypt Data
     */
    encrypt(plaintext, password = null) {
        try {
            const key = password ? 
                this.deriveKey(password, Buffer.from(this.masterKey, 'hex').slice(0, this.saltLength)) :
                Buffer.from(this.masterKey, 'hex');
            
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipher(this.algorithm, key, iv);
            
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const tag = cipher.getAuthTag();
            
            return {
                encrypted: encrypted,
                iv: iv.toString('hex'),
                tag: tag.toString('hex'),
                algorithm: this.algorithm
            };
        } catch (error) {
            throw new Error(`加密失败 / Encryption failed: ${error.message}`);
        }
    }

    /**
     * 解密数据
     * Decrypt Data
     */
    decrypt(encryptedData, password = null) {
        try {
            const { encrypted, iv, tag, algorithm } = encryptedData;
            
            const key = password ? 
                this.deriveKey(password, Buffer.from(this.masterKey, 'hex').slice(0, this.saltLength)) :
                Buffer.from(this.masterKey, 'hex');
            
            const decipher = crypto.createDecipher(algorithm, key, Buffer.from(iv, 'hex'));
            decipher.setAuthTag(Buffer.from(tag, 'hex'));
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            throw new Error(`解密失败 / Decryption failed: ${error.message}`);
        }
    }

    /**
     * 加密敏感字段
     * Encrypt Sensitive Fields
     */
    encryptSensitiveData(data, sensitiveFields = []) {
        const encrypted = { ...data };
        
        for (const field of sensitiveFields) {
            if (encrypted[field]) {
                encrypted[field] = this.encrypt(encrypted[field]);
            }
        }
        
        return encrypted;
    }

    /**
     * 解密敏感字段
     * Decrypt Sensitive Fields
     */
    decryptSensitiveData(data, sensitiveFields = []) {
        const decrypted = { ...data };
        
        for (const field of sensitiveFields) {
            if (decrypted[field] && typeof decrypted[field] === 'object') {
                try {
                    decrypted[field] = this.decrypt(decrypted[field]);
                } catch (error) {
                    console.error(`解密字段 ${field} 失败:`, error);
                    decrypted[field] = null;
                }
            }
        }
        
        return decrypted;
    }

    /**
     * 哈希密码
     * Hash Password
     */
    async hashPassword(password) {
        try {
            const saltRounds = 12;
            return await bcrypt.hash(password, saltRounds);
        } catch (error) {
            throw new Error(`密码哈希失败 / Password hashing failed: ${error.message}`);
        }
    }

    /**
     * 验证密码
     * Verify Password
     */
    async verifyPassword(password, hashedPassword) {
        try {
            return await bcrypt.compare(password, hashedPassword);
        } catch (error) {
            throw new Error(`密码验证失败 / Password verification failed: ${error.message}`);
        }
    }

    /**
     * 生成安全令牌
     * Generate Secure Token
     */
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * 生成JWT令牌
     * Generate JWT Token
     */
    generateJWT(payload, expiresIn = '24h') {
        try {
            const secret = process.env.JWT_SECRET || this.masterKey;
            return jwt.sign(payload, secret, { 
                expiresIn,
                issuer: 'CultureBridge',
                audience: 'CultureBridge-Users'
            });
        } catch (error) {
            throw new Error(`JWT生成失败 / JWT generation failed: ${error.message}`);
        }
    }

    /**
     * 验证JWT令牌
     * Verify JWT Token
     */
    verifyJWT(token) {
        try {
            const secret = process.env.JWT_SECRET || this.masterKey;
            return jwt.verify(token, secret, {
                issuer: 'CultureBridge',
                audience: 'CultureBridge-Users'
            });
        } catch (error) {
            throw new Error(`JWT验证失败 / JWT verification failed: ${error.message}`);
        }
    }

    /**
     * 生成API密钥
     * Generate API Key
     */
    generateAPIKey(userId, permissions = []) {
        const payload = {
            userId,
            permissions,
            type: 'api_key',
            createdAt: Date.now()
        };
        
        return this.generateJWT(payload, '1y'); // API密钥有效期1年
    }

    /**
     * 验证API密钥
     * Verify API Key
     */
    verifyAPIKey(apiKey) {
        try {
            const decoded = this.verifyJWT(apiKey);
            
            if (decoded.type !== 'api_key') {
                throw new Error('Invalid API key type');
            }
            
            return decoded;
        } catch (error) {
            throw new Error(`API密钥验证失败 / API key verification failed: ${error.message}`);
        }
    }

    /**
     * 生成数字签名
     * Generate Digital Signature
     */
    generateSignature(data, privateKey = null) {
        try {
            const key = privateKey || this.masterKey;
            const sign = crypto.createSign('RSA-SHA256');
            sign.update(JSON.stringify(data));
            return sign.sign(key, 'hex');
        } catch (error) {
            // 如果RSA签名失败，使用HMAC
            const hmac = crypto.createHmac('sha256', this.masterKey);
            hmac.update(JSON.stringify(data));
            return hmac.digest('hex');
        }
    }

    /**
     * 验证数字签名
     * Verify Digital Signature
     */
    verifySignature(data, signature, publicKey = null) {
        try {
            if (publicKey) {
                const verify = crypto.createVerify('RSA-SHA256');
                verify.update(JSON.stringify(data));
                return verify.verify(publicKey, signature, 'hex');
            } else {
                // 使用HMAC验证
                const expectedSignature = this.generateSignature(data);
                return crypto.timingSafeEqual(
                    Buffer.from(signature, 'hex'),
                    Buffer.from(expectedSignature, 'hex')
                );
            }
        } catch (error) {
            console.error('签名验证失败:', error);
            return false;
        }
    }

    /**
     * 生成一次性密码 (OTP)
     * Generate One-Time Password
     */
    generateOTP(length = 6) {
        const digits = '0123456789';
        let otp = '';
        
        for (let i = 0; i < length; i++) {
            const randomIndex = crypto.randomInt(0, digits.length);
            otp += digits[randomIndex];
        }
        
        return otp;
    }

    /**
     * 生成TOTP (基于时间的一次性密码)
     * Generate Time-based One-Time Password
     */
    generateTOTP(secret, timeStep = 30, digits = 6) {
        const time = Math.floor(Date.now() / 1000 / timeStep);
        const timeBuffer = Buffer.alloc(8);
        timeBuffer.writeUInt32BE(0, 0);
        timeBuffer.writeUInt32BE(time, 4);
        
        const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base32'));
        hmac.update(timeBuffer);
        const hash = hmac.digest();
        
        const offset = hash[hash.length - 1] & 0xf;
        const code = (hash.readUInt32BE(offset) & 0x7fffffff) % Math.pow(10, digits);
        
        return code.toString().padStart(digits, '0');
    }

    /**
     * 验证TOTP
     * Verify TOTP
     */
    verifyTOTP(token, secret, window = 1, timeStep = 30, digits = 6) {
        const currentTime = Math.floor(Date.now() / 1000 / timeStep);
        
        for (let i = -window; i <= window; i++) {
            const time = currentTime + i;
            const timeBuffer = Buffer.alloc(8);
            timeBuffer.writeUInt32BE(0, 0);
            timeBuffer.writeUInt32BE(time, 4);
            
            const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base32'));
            hmac.update(timeBuffer);
            const hash = hmac.digest();
            
            const offset = hash[hash.length - 1] & 0xf;
            const code = (hash.readUInt32BE(offset) & 0x7fffffff) % Math.pow(10, digits);
            const expectedToken = code.toString().padStart(digits, '0');
            
            if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 生成安全的随机字符串
     * Generate Secure Random String
     */
    generateSecureRandomString(length = 32, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
        let result = '';
        const charsetLength = charset.length;
        
        for (let i = 0; i < length; i++) {
            const randomIndex = crypto.randomInt(0, charsetLength);
            result += charset[randomIndex];
        }
        
        return result;
    }

    /**
     * 计算文件哈希
     * Calculate File Hash
     */
    calculateFileHash(buffer, algorithm = 'sha256') {
        const hash = crypto.createHash(algorithm);
        hash.update(buffer);
        return hash.digest('hex');
    }

    /**
     * 安全比较字符串
     * Secure String Comparison
     */
    secureCompare(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }

    /**
     * 生成密钥对
     * Generate Key Pair
     */
    generateKeyPair() {
        return crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
    }

    /**
     * 加密大文件
     * Encrypt Large File
     */
    encryptStream() {
        const key = Buffer.from(this.masterKey, 'hex');
        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipher(this.algorithm, key, iv);
        
        return {
            cipher,
            iv: iv.toString('hex')
        };
    }

    /**
     * 解密大文件
     * Decrypt Large File
     */
    decryptStream(iv, tag) {
        const key = Buffer.from(this.masterKey, 'hex');
        const decipher = crypto.createDecipher(this.algorithm, key, Buffer.from(iv, 'hex'));
        
        if (tag) {
            decipher.setAuthTag(Buffer.from(tag, 'hex'));
        }
        
        return decipher;
    }
}

module.exports = EncryptionService;

