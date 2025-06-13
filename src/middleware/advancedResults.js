const mongoose = require('mongoose');

/**
 * 高级查询结果中间件
 * 提供分页、排序、字段选择、搜索等功能
 */
const advancedResults = (model, populate) => async (req, res, next) => {
    let query;

    // 复制请求查询参数
    const reqQuery = { ...req.query };

    // 移除不用于过滤的字段
    const removeFields = ['select', 'sort', 'page', 'limit', 'search'];
    removeFields.forEach(param => delete reqQuery[param]);

    // 创建查询字符串
    let queryStr = JSON.stringify(reqQuery);

    // 创建操作符 ($gt, $gte, $lt, $lte, $in)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    // 解析查询字符串
    const parsedQuery = JSON.parse(queryStr);

    // 处理搜索功能
    if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, 'i');
        
        // 根据模型确定搜索字段
        let searchFields = [];
        if (model.modelName === 'User') {
            searchFields = ['username', 'email'];
        } else if (model.modelName === 'Post') {
            searchFields = ['title', 'content'];
        } else if (model.modelName === 'Topic') {
            searchFields = ['title', 'description'];
        } else if (model.modelName === 'Resource') {
            searchFields = ['title', 'description'];
        } else if (model.modelName === 'Event') {
            searchFields = ['title', 'description'];
        } else if (model.modelName === 'Community') {
            searchFields = ['name', 'description'];
        } else if (model.modelName === 'ChatRoom') {
            searchFields = ['name', 'description'];
        }

        if (searchFields.length > 0) {
            parsedQuery.$or = searchFields.map(field => ({
                [field]: searchRegex
            }));
        }
    }

    // 查找资源
    query = model.find(parsedQuery);

    // 字段选择
    if (req.query.select) {
        const fields = req.query.select.split(',').join(' ');
        query = query.select(fields);
    }

    // 排序
    if (req.query.sort) {
        const sortBy = req.query.sort.split(',').join(' ');
        query = query.sort(sortBy);
    } else {
        query = query.sort('-createdAt');
    }

    // 分页
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await model.countDocuments(parsedQuery);

    query = query.skip(startIndex).limit(limit);

    // 填充关联数据
    if (populate) {
        if (Array.isArray(populate)) {
            populate.forEach(pop => {
                query = query.populate(pop);
            });
        } else {
            query = query.populate(populate);
        }
    }

    // 执行查询
    try {
        const results = await query;

        // 分页结果
        const pagination = {};

        if (endIndex < total) {
            pagination.next = {
                page: page + 1,
                limit
            };
        }

        if (startIndex > 0) {
            pagination.prev = {
                page: page - 1,
                limit
            };
        }

        res.advancedResults = {
            success: true,
            count: results.length,
            total,
            pagination,
            data: results
        };

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = advancedResults;

