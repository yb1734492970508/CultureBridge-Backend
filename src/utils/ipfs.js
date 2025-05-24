// src/utils/ipfs.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// 使用Pinata作为IPFS服务提供商
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

/**
 * 将文件上传到IPFS
 * @param {string} filePath 文件路径
 * @param {string} name 文件名称
 * @returns {Promise<string>} IPFS URI
 */
exports.uploadFileToIPFS = async (filePath, name) => {
  try {
    // 检查API密钥是否配置
    if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
      throw new Error('Pinata API密钥未配置');
    }

    // 准备表单数据
    const formData = new FormData();
    const file = fs.createReadStream(filePath);
    formData.append('file', file);
    
    // 添加元数据
    const metadata = JSON.stringify({
      name: name || path.basename(filePath),
      keyvalues: {
        app: 'CultureBridge',
        timestamp: Date.now().toString()
      }
    });
    formData.append('pinataMetadata', metadata);
    
    // 设置上传选项
    const options = JSON.stringify({
      cidVersion: 0
    });
    formData.append('pinataOptions', options);
    
    // 发送请求
    const response = await axios.post(PINATA_API_URL, formData, {
      maxBodyLength: 'Infinity',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY
      }
    });
    
    // 返回IPFS URI
    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error('上传文件到IPFS失败:', error);
    throw error;
  }
};

/**
 * 将JSON数据上传到IPFS
 * @param {string} jsonData JSON数据字符串
 * @param {string} existingUri 现有URI（用于更新）
 * @returns {Promise<string>} IPFS URI
 */
exports.uploadToIPFS = async (jsonData, existingUri = null) => {
  try {
    // 检查API密钥是否配置
    if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
      // 如果未配置Pinata，返回模拟URI
      console.warn('Pinata API密钥未配置，返回模拟URI');
      return `ipfs://mock-${Date.now()}`;
    }
    
    // 解析JSON数据
    const data = JSON.parse(jsonData);
    
    // 添加元数据
    const pinataOptions = {
      cidVersion: 0
    };
    
    const pinataMetadata = {
      name: data.name || `CultureBridge-Metadata-${Date.now()}`,
      keyvalues: {
        app: 'CultureBridge',
        timestamp: Date.now().toString()
      }
    };
    
    // 如果是更新现有URI，添加相关标记
    if (existingUri) {
      pinataMetadata.keyvalues.update = 'true';
      pinataMetadata.keyvalues.originalUri = existingUri;
    }
    
    // 发送请求
    const response = await axios.post(PINATA_JSON_URL, data, {
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY
      },
      params: {
        pinataOptions: JSON.stringify(pinataOptions),
        pinataMetadata: JSON.stringify(pinataMetadata)
      }
    });
    
    // 返回IPFS URI
    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error('上传JSON到IPFS失败:', error);
    // 如果失败，返回模拟URI
    return `ipfs://mock-${Date.now()}`;
  }
};

/**
 * 从IPFS获取数据
 * @param {string} uri IPFS URI
 * @returns {Promise<Object>} JSON数据
 */
exports.getFromIPFS = async (uri) => {
  try {
    // 检查URI格式
    if (!uri.startsWith('ipfs://')) {
      throw new Error('无效的IPFS URI格式');
    }
    
    // 提取哈希
    const hash = uri.replace('ipfs://', '');
    
    // 如果是模拟URI，返回模拟数据
    if (hash.startsWith('mock-')) {
      return {
        name: 'Mock Asset',
        description: 'This is a mock asset metadata',
        image: 'https://via.placeholder.com/350x150',
        attributes: []
      };
    }
    
    // 从IPFS网关获取数据
    const gateway = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
    const url = `${gateway}${hash}`;
    
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('从IPFS获取数据失败:', error);
    // 返回模拟数据
    return {
      name: 'Fallback Asset',
      description: 'Failed to fetch original metadata',
      image: 'https://via.placeholder.com/350x150',
      attributes: []
    };
  }
};
