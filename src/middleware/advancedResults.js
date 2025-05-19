// 高级结果中间件
const advancedResults = (model, populate) => async (req, res, next) => {
  let query;

  // 复制req.query
  const reqQuery = { ...req.query };

  // 要排除的字段
  const removeFields = ['select', 'sort', 'page', 'limit'];

  // 从query中删除这些字段
  removeFields.forEach(param => delete reqQuery[param]);

  // 创建查询字符串
  let queryStr = JSON.stringify(reqQuery);

  // 创建操作符 ($gt, $gte, 等)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // 查找资源
  query = model.find(JSON.parse(queryStr));

  // Select字段
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
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await model.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  if (populate) {
    query = query.populate(populate);
  }

  // 执行查询
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
    pagination,
    data: results
  };

  next();
};

module.exports = advancedResults;
