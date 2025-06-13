const express = require('express');
const router = express.Router();
const ExchangeIntegrationService = require('../services/exchangeIntegrationService');

// 初始化交易所集成服务
const exchangeService = new ExchangeIntegrationService();

/**
 * @route GET /api/exchange/token-info
 * @description 获取代币信息包
 */
router.get('/token-info', async (req, res) => {
    try {
        const tokenPackage = exchangeService.generateTokenInfoPackage();
        res.json({
            success: true,
            data: tokenPackage,
            message: '代币信息包生成成功'
        });
    } catch (error) {
        console.error('获取代币信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取代币信息失败',
            error: error.message
        });
    }
});

/**
 * @route GET /api/exchange/pancakeswap-listing
 * @description 获取 PancakeSwap 上线准备信息
 */
router.get('/pancakeswap-listing', async (req, res) => {
    try {
        const listingInfo = exchangeService.generatePancakeSwapListing();
        res.json({
            success: true,
            data: listingInfo,
            message: 'PancakeSwap 上线信息生成成功'
        });
    } catch (error) {
        console.error('获取 PancakeSwap 上线信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取 PancakeSwap 上线信息失败',
            error: error.message
        });
    }
});

/**
 * @route GET /api/exchange/cmc-application
 * @description 获取 CoinMarketCap 上线申请信息
 */
router.get('/cmc-application', async (req, res) => {
    try {
        const application = exchangeService.generateCMCApplication();
        res.json({
            success: true,
            data: application,
            message: 'CoinMarketCap 申请信息生成成功'
        });
    } catch (error) {
        console.error('获取 CoinMarketCap 申请信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取 CoinMarketCap 申请信息失败',
            error: error.message
        });
    }
});

/**
 * @route GET /api/exchange/coingecko-application
 * @description 获取 CoinGecko 上线申请信息
 */
router.get('/coingecko-application', async (req, res) => {
    try {
        const application = exchangeService.generateCoinGeckoApplication();
        res.json({
            success: true,
            data: application,
            message: 'CoinGecko 申请信息生成成功'
        });
    } catch (error) {
        console.error('获取 CoinGecko 申请信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取 CoinGecko 申请信息失败',
            error: error.message
        });
    }
});

/**
 * @route GET /api/exchange/readiness-check
 * @description 检查上线准备状态
 */
router.get('/readiness-check', async (req, res) => {
    try {
        const readiness = exchangeService.checkListingReadiness();
        res.json({
            success: true,
            data: readiness,
            message: '上线准备状态检查完成'
        });
    } catch (error) {
        console.error('检查上线准备状态失败:', error);
        res.status(500).json({
            success: false,
            message: '检查上线准备状态失败',
            error: error.message
        });
    }
});

/**
 * @route GET /api/exchange/timeline
 * @description 获取上线时间表
 */
router.get('/timeline', async (req, res) => {
    try {
        const timeline = exchangeService.generateListingTimeline();
        res.json({
            success: true,
            data: timeline,
            message: '上线时间表生成成功'
        });
    } catch (error) {
        console.error('获取上线时间表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取上线时间表失败',
            error: error.message
        });
    }
});

/**
 * @route GET /api/exchange/contacts
 * @description 获取交易所联系信息
 */
router.get('/contacts', async (req, res) => {
    try {
        const contacts = exchangeService.getExchangeContacts();
        res.json({
            success: true,
            data: contacts,
            message: '交易所联系信息获取成功'
        });
    } catch (error) {
        console.error('获取交易所联系信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取交易所联系信息失败',
            error: error.message
        });
    }
});

/**
 * @route GET /api/exchange/status
 * @description 获取交易所集成服务状态
 */
router.get('/status', async (req, res) => {
    try {
        const status = {
            service: 'Exchange Integration Service',
            version: '1.0.0',
            status: 'active',
            features: [
                'Token Information Package',
                'DEX Listing Preparation',
                'CMC/CoinGecko Applications',
                'Readiness Assessment',
                'Timeline Planning',
                'Exchange Contacts'
            ],
            lastUpdated: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: status,
            message: '交易所集成服务状态正常'
        });
    } catch (error) {
        console.error('获取服务状态失败:', error);
        res.status(500).json({
            success: false,
            message: '获取服务状态失败',
            error: error.message
        });
    }
});

module.exports = router;

