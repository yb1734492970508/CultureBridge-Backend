# CultureBridge API 文档

## 基础信息

- 基础URL: `/api/v1`
- 所有请求和响应均使用JSON格式
- 认证使用Bearer Token方式

## 认证API

### 注册用户

- **URL**: `/auth/register`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "username": "用户名",
    "email": "邮箱",
    "password": "密码"
  }
  ```
- **成功响应** (201):
  ```json
  {
    "success": true,
    "token": "认证令牌"
  }
  ```

### 用户登录

- **URL**: `/auth/login`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "email": "邮箱",
    "password": "密码"
  }
  ```
- **成功响应** (200):
  ```json
  {
    "success": true,
    "token": "认证令牌"
  }
  ```

### 用户登出

- **URL**: `/auth/logout`
- **方法**: `GET`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

### 获取当前用户

- **URL**: `/auth/me`
- **方法**: `GET`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "用户ID",
      "username": "用户名",
      "email": "邮箱",
      "role": "角色",
      "createdAt": "创建时间"
    }
  }
  ```

### 更新用户信息

- **URL**: `/auth/updatedetails`
- **方法**: `PUT`
- **认证**: 需要
- **请求体**:
  ```json
  {
    "username": "新用户名",
    "email": "新邮箱"
  }
  ```
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "用户ID",
      "username": "新用户名",
      "email": "新邮箱",
      "role": "角色",
      "createdAt": "创建时间"
    }
  }
  ```

### 更新密码

- **URL**: `/auth/updatepassword`
- **方法**: `PUT`
- **认证**: 需要
- **请求体**:
  ```json
  {
    "currentPassword": "当前密码",
    "newPassword": "新密码"
  }
  ```
- **成功响应** (200):
  ```json
  {
    "success": true,
    "token": "新认证令牌"
  }
  ```

## 个人资料API

### 获取所有个人资料

- **URL**: `/profiles`
- **方法**: `GET`
- **查询参数**:
  - `select`: 选择字段，如 `name,bio,location`
  - `sort`: 排序字段，如 `-createdAt`
  - `page`: 页码，默认1
  - `limit`: 每页数量，默认10
- **成功响应** (200):
  ```json
  {
    "success": true,
    "count": 数量,
    "pagination": {
      "next": { "page": 下一页, "limit": 每页数量 },
      "prev": { "page": 上一页, "limit": 每页数量 }
    },
    "data": [
      {
        "id": "资料ID",
        "user": {
          "id": "用户ID",
          "username": "用户名",
          "email": "邮箱"
        },
        "name": "姓名",
        "avatar": "头像URL",
        "bio": "个人简介",
        "location": "位置",
        "languages": [
          {
            "language": "语言",
            "proficiency": "熟练度"
          }
        ],
        "interests": ["兴趣1", "兴趣2"],
        "socialMedia": {
          "wechat": "微信",
          "weibo": "微博",
          "facebook": "Facebook",
          "twitter": "Twitter",
          "instagram": "Instagram",
          "linkedin": "LinkedIn"
        },
        "createdAt": "创建时间"
      }
    ]
  }
  ```

### 获取单个个人资料

- **URL**: `/profiles/:id`
- **方法**: `GET`
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "资料ID",
      "user": {
        "id": "用户ID",
        "username": "用户名",
        "email": "邮箱"
      },
      "name": "姓名",
      "avatar": "头像URL",
      "bio": "个人简介",
      "location": "位置",
      "languages": [
        {
          "language": "语言",
          "proficiency": "熟练度"
        }
      ],
      "interests": ["兴趣1", "兴趣2"],
      "socialMedia": {
        "wechat": "微信",
        "weibo": "微博",
        "facebook": "Facebook",
        "twitter": "Twitter",
        "instagram": "Instagram",
        "linkedin": "LinkedIn"
      },
      "createdAt": "创建时间"
    }
  }
  ```

### 创建个人资料

- **URL**: `/profiles`
- **方法**: `POST`
- **认证**: 需要
- **请求体**:
  ```json
  {
    "name": "姓名",
    "avatar": "头像URL",
    "bio": "个人简介",
    "location": "位置",
    "languages": [
      {
        "language": "语言",
        "proficiency": "熟练度"
      }
    ],
    "interests": ["兴趣1", "兴趣2"],
    "socialMedia": {
      "wechat": "微信",
      "weibo": "微博",
      "facebook": "Facebook",
      "twitter": "Twitter",
      "instagram": "Instagram",
      "linkedin": "LinkedIn"
    }
  }
  ```
- **成功响应** (201):
  ```json
  {
    "success": true,
    "data": {
      "id": "资料ID",
      "user": "用户ID",
      "name": "姓名",
      "avatar": "头像URL",
      "bio": "个人简介",
      "location": "位置",
      "languages": [
        {
          "language": "语言",
          "proficiency": "熟练度"
        }
      ],
      "interests": ["兴趣1", "兴趣2"],
      "socialMedia": {
        "wechat": "微信",
        "weibo": "微博",
        "facebook": "Facebook",
        "twitter": "Twitter",
        "instagram": "Instagram",
        "linkedin": "LinkedIn"
      },
      "createdAt": "创建时间"
    }
  }
  ```

### 更新个人资料

- **URL**: `/profiles/:id`
- **方法**: `PUT`
- **认证**: 需要
- **请求体**: 同创建个人资料
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "资料ID",
      "user": "用户ID",
      "name": "姓名",
      "avatar": "头像URL",
      "bio": "个人简介",
      "location": "位置",
      "languages": [
        {
          "language": "语言",
          "proficiency": "熟练度"
        }
      ],
      "interests": ["兴趣1", "兴趣2"],
      "socialMedia": {
        "wechat": "微信",
        "weibo": "微博",
        "facebook": "Facebook",
        "twitter": "Twitter",
        "instagram": "Instagram",
        "linkedin": "LinkedIn"
      },
      "createdAt": "创建时间"
    }
  }
  ```

### 删除个人资料

- **URL**: `/profiles/:id`
- **方法**: `DELETE`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

## 话题API

### 获取所有话题

- **URL**: `/topics`
- **方法**: `GET`
- **查询参数**:
  - `select`: 选择字段
  - `sort`: 排序字段
  - `page`: 页码
  - `limit`: 每页数量
- **成功响应** (200):
  ```json
  {
    "success": true,
    "count": 数量,
    "pagination": {
      "next": { "page": 下一页, "limit": 每页数量 },
      "prev": { "page": 上一页, "limit": 每页数量 }
    },
    "data": [
      {
        "id": "话题ID",
        "title": "标题",
        "description": "描述",
        "category": "分类",
        "tags": ["标签1", "标签2"],
        "user": {
          "id": "用户ID",
          "username": "用户名"
        },
        "createdAt": "创建时间"
      }
    ]
  }
  ```

### 获取单个话题

- **URL**: `/topics/:id`
- **方法**: `GET`
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "话题ID",
      "title": "标题",
      "description": "描述",
      "category": "分类",
      "tags": ["标签1", "标签2"],
      "user": {
        "id": "用户ID",
        "username": "用户名"
      },
      "createdAt": "创建时间"
    }
  }
  ```

### 创建话题

- **URL**: `/topics`
- **方法**: `POST`
- **认证**: 需要
- **请求体**:
  ```json
  {
    "title": "标题",
    "description": "描述",
    "category": "分类",
    "tags": ["标签1", "标签2"]
  }
  ```
- **成功响应** (201):
  ```json
  {
    "success": true,
    "data": {
      "id": "话题ID",
      "title": "标题",
      "description": "描述",
      "category": "分类",
      "tags": ["标签1", "标签2"],
      "user": "用户ID",
      "createdAt": "创建时间"
    }
  }
  ```

### 更新话题

- **URL**: `/topics/:id`
- **方法**: `PUT`
- **认证**: 需要
- **请求体**: 同创建话题
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "话题ID",
      "title": "标题",
      "description": "描述",
      "category": "分类",
      "tags": ["标签1", "标签2"],
      "user": "用户ID",
      "createdAt": "创建时间"
    }
  }
  ```

### 删除话题

- **URL**: `/topics/:id`
- **方法**: `DELETE`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

## 帖子API

### 获取所有帖子

- **URL**: `/posts`
- **方法**: `GET`
- **查询参数**:
  - `select`: 选择字段
  - `sort`: 排序字段
  - `page`: 页码
  - `limit`: 每页数量
- **成功响应** (200):
  ```json
  {
    "success": true,
    "count": 数量,
    "pagination": {
      "next": { "page": 下一页, "limit": 每页数量 },
      "prev": { "page": 上一页, "limit": 每页数量 }
    },
    "data": [
      {
        "id": "帖子ID",
        "title": "标题",
        "content": "内容",
        "images": ["图片URL1", "图片URL2"],
        "likes": ["用户ID1", "用户ID2"],
        "user": {
          "id": "用户ID",
          "username": "用户名"
        },
        "topic": {
          "id": "话题ID",
          "title": "话题标题",
          "category": "话题分类"
        },
        "createdAt": "创建时间"
      }
    ]
  }
  ```

### 获取话题下的所有帖子

- **URL**: `/topics/:topicId/posts`
- **方法**: `GET`
- **成功响应** (200):
  ```json
  {
    "success": true,
    "count": 数量,
    "data": [
      {
        "id": "帖子ID",
        "title": "标题",
        "content": "内容",
        "images": ["图片URL1", "图片URL2"],
        "likes": ["用户ID1", "用户ID2"],
        "user": {
          "id": "用户ID",
          "username": "用户名"
        },
        "topic": "话题ID",
        "createdAt": "创建时间"
      }
    ]
  }
  ```

### 获取单个帖子

- **URL**: `/posts/:id`
- **方法**: `GET`
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "帖子ID",
      "title": "标题",
      "content": "内容",
      "images": ["图片URL1", "图片URL2"],
      "likes": ["用户ID1", "用户ID2"],
      "user": {
        "id": "用户ID",
        "username": "用户名"
      },
      "topic": {
        "id": "话题ID",
        "title": "话题标题",
        "category": "话题分类"
      },
      "createdAt": "创建时间"
    }
  }
  ```

### 创建帖子

- **URL**: `/topics/:topicId/posts`
- **方法**: `POST`
- **认证**: 需要
- **请求体**:
  ```json
  {
    "title": "标题",
    "content": "内容",
    "images": ["图片URL1", "图片URL2"]
  }
  ```
- **成功响应** (201):
  ```json
  {
    "success": true,
    "data": {
      "id": "帖子ID",
      "title": "标题",
      "content": "内容",
      "images": ["图片URL1", "图片URL2"],
      "likes": [],
      "user": "用户ID",
      "topic": "话题ID",
      "createdAt": "创建时间"
    }
  }
  ```

### 更新帖子

- **URL**: `/posts/:id`
- **方法**: `PUT`
- **认证**: 需要
- **请求体**: 同创建帖子
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "帖子ID",
      "title": "标题",
      "content": "内容",
      "images": ["图片URL1", "图片URL2"],
      "likes": ["用户ID1", "用户ID2"],
      "user": "用户ID",
      "topic": "话题ID",
      "createdAt": "创建时间"
    }
  }
  ```

### 删除帖子

- **URL**: `/posts/:id`
- **方法**: `DELETE`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

### 点赞帖子

- **URL**: `/posts/:id/like`
- **方法**: `PUT`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "帖子ID",
      "title": "标题",
      "content": "内容",
      "images": ["图片URL1", "图片URL2"],
      "likes": ["用户ID1", "用户ID2", "当前用户ID"],
      "user": "用户ID",
      "topic": "话题ID",
      "createdAt": "创建时间"
    }
  }
  ```

### 取消点赞帖子

- **URL**: `/posts/:id/unlike`
- **方法**: `PUT`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "帖子ID",
      "title": "标题",
      "content": "内容",
      "images": ["图片URL1", "图片URL2"],
      "likes": ["用户ID1", "用户ID2"],
      "user": "用户ID",
      "topic": "话题ID",
      "createdAt": "创建时间"
    }
  }
  ```

## 评论API

### 获取所有评论

- **URL**: `/comments`
- **方法**: `GET`
- **查询参数**:
  - `select`: 选择字段
  - `sort`: 排序字段
  - `page`: 页码
  - `limit`: 每页数量
- **成功响应** (200):
  ```json
  {
    "success": true,
    "count": 数量,
    "pagination": {
      "next": { "page": 下一页, "limit": 每页数量 },
      "prev": { "page": 上一页, "limit": 每页数量 }
    },
    "data": [
      {
        "id": "评论ID",
        "content": "内容",
        "likes": ["用户ID1", "用户ID2"],
        "user": {
          "id": "用户ID",
          "username": "用户名"
        },
        "post": {
          "id": "帖子ID",
          "title": "帖子标题"
        },
        "createdAt": "创建时间"
      }
    ]
  }
  ```

### 获取帖子下的所有评论

- **URL**: `/posts/:postId/comments`
- **方法**: `GET`
- **成功响应** (200):
  ```json
  {
    "success": true,
    "count": 数量,
    "data": [
      {
        "id": "评论ID",
        "content": "内容",
        "likes": ["用户ID1", "用户ID2"],
        "user": {
          "id": "用户ID",
          "username": "用户名"
        },
        "post": "帖子ID",
        "createdAt": "创建时间"
      }
    ]
  }
  ```

### 获取单个评论

- **URL**: `/comments/:id`
- **方法**: `GET`
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "评论ID",
      "content": "内容",
      "likes": ["用户ID1", "用户ID2"],
      "user": {
        "id": "用户ID",
        "username": "用户名"
      },
      "post": {
        "id": "帖子ID",
        "title": "帖子标题"
      },
      "createdAt": "创建时间"
    }
  }
  ```

### 创建评论

- **URL**: `/posts/:postId/comments`
- **方法**: `POST`
- **认证**: 需要
- **请求体**:
  ```json
  {
    "content": "内容"
  }
  ```
- **成功响应** (201):
  ```json
  {
    "success": true,
    "data": {
      "id": "评论ID",
      "content": "内容",
      "likes": [],
      "user": "用户ID",
      "post": "帖子ID",
      "createdAt": "创建时间"
    }
  }
  ```

### 更新评论

- **URL**: `/comments/:id`
- **方法**: `PUT`
- **认证**: 需要
- **请求体**: 同创建评论
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "评论ID",
      "content": "内容",
      "likes": ["用户ID1", "用户ID2"],
      "user": "用户ID",
      "post": "帖子ID",
      "createdAt": "创建时间"
    }
  }
  ```

### 删除评论

- **URL**: `/comments/:id`
- **方法**: `DELETE`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

### 点赞评论

- **URL**: `/comments/:id/like`
- **方法**: `PUT`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "评论ID",
      "content": "内容",
      "likes": ["用户ID1", "用户ID2", "当前用户ID"],
      "user": "用户ID",
      "post": "帖子ID",
      "createdAt": "创建时间"
    }
  }
  ```

### 取消点赞评论

- **URL**: `/comments/:id/unlike`
- **方法**: `PUT`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "评论ID",
      "content": "内容",
      "likes": ["用户ID1", "用户ID2"],
      "user": "用户ID",
      "post": "帖子ID",
      "createdAt": "创建时间"
    }
  }
  ```

## 学习资源API

### 获取所有学习资源

- **URL**: `/resources`
- **方法**: `GET`
- **查询参数**:
  - `select`: 选择字段
  - `sort`: 排序字段
  - `page`: 页码
  - `limit`: 每页数量
- **成功响应** (200):
  ```json
  {
    "success": true,
    "count": 数量,
    "pagination": {
      "next": { "page": 下一页, "limit": 每页数量 },
      "prev": { "page": 上一页, "limit": 每页数量 }
    },
    "data": [
      {
        "id": "资源ID",
        "title": "标题",
        "description": "描述",
        "type": "类型",
        "category": "分类",
        "language": "语言",
        "level": "级别",
        "file": "文件URL",
        "link": "链接",
        "tags": ["标签1", "标签2"],
        "user": {
          "id": "用户ID",
          "username": "用户名"
        },
        "ratings": [
          {
            "user": "用户ID",
            "rating": 评分
          }
        ],
        "averageRating": 平均评分,
        "createdAt": "创建时间"
      }
    ]
  }
  ```

### 获取单个学习资源

- **URL**: `/resources/:id`
- **方法**: `GET`
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "资源ID",
      "title": "标题",
      "description": "描述",
      "type": "类型",
      "category": "分类",
      "language": "语言",
      "level": "级别",
      "file": "文件URL",
      "link": "链接",
      "tags": ["标签1", "标签2"],
      "user": {
        "id": "用户ID",
        "username": "用户名"
      },
      "ratings": [
        {
          "user": "用户ID",
          "rating": 评分
        }
      ],
      "averageRating": 平均评分,
      "createdAt": "创建时间"
    }
  }
  ```

### 创建学习资源

- **URL**: `/resources`
- **方法**: `POST`
- **认证**: 需要
- **请求体**:
  ```json
  {
    "title": "标题",
    "description": "描述",
    "type": "类型",
    "category": "分类",
    "language": "语言",
    "level": "级别",
    "file": "文件URL",
    "link": "链接",
    "tags": ["标签1", "标签2"]
  }
  ```
- **成功响应** (201):
  ```json
  {
    "success": true,
    "data": {
      "id": "资源ID",
      "title": "标题",
      "description": "描述",
      "type": "类型",
      "category": "分类",
      "language": "语言",
      "level": "级别",
      "file": "文件URL",
      "link": "链接",
      "tags": ["标签1", "标签2"],
      "user": "用户ID",
      "ratings": [],
      "averageRating": 0,
      "createdAt": "创建时间"
    }
  }
  ```

### 更新学习资源

- **URL**: `/resources/:id`
- **方法**: `PUT`
- **认证**: 需要
- **请求体**: 同创建学习资源
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "资源ID",
      "title": "标题",
      "description": "描述",
      "type": "类型",
      "category": "分类",
      "language": "语言",
      "level": "级别",
      "file": "文件URL",
      "link": "链接",
      "tags": ["标签1", "标签2"],
      "user": "用户ID",
      "ratings": [
        {
          "user": "用户ID",
          "rating": 评分
        }
      ],
      "averageRating": 平均评分,
      "createdAt": "创建时间"
    }
  }
  ```

### 删除学习资源

- **URL**: `/resources/:id`
- **方法**: `DELETE`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

### 评分学习资源

- **URL**: `/resources/:id/rate`
- **方法**: `PUT`
- **认证**: 需要
- **请求体**:
  ```json
  {
    "rating": 评分
  }
  ```
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "资源ID",
      "title": "标题",
      "description": "描述",
      "type": "类型",
      "category": "分类",
      "language": "语言",
      "level": "级别",
      "file": "文件URL",
      "link": "链接",
      "tags": ["标签1", "标签2"],
      "user": "用户ID",
      "ratings": [
        {
          "user": "用户ID",
          "rating": 评分
        },
        {
          "user": "当前用户ID",
          "rating": 新评分
        }
      ],
      "averageRating": 新平均评分,
      "createdAt": "创建时间"
    }
  }
  ```

## 活动API

### 获取所有活动

- **URL**: `/events`
- **方法**: `GET`
- **查询参数**:
  - `select`: 选择字段
  - `sort`: 排序字段
  - `page`: 页码
  - `limit`: 每页数量
- **成功响应** (200):
  ```json
  {
    "success": true,
    "count": 数量,
    "pagination": {
      "next": { "page": 下一页, "limit": 每页数量 },
      "prev": { "page": 上一页, "limit": 每页数量 }
    },
    "data": [
      {
        "id": "活动ID",
        "title": "标题",
        "description": "描述",
        "location": "地点",
        "startDate": "开始时间",
        "endDate": "结束时间",
        "category": "分类",
        "image": "图片URL",
        "capacity": 容量,
        "fee": 费用,
        "organizer": {
          "id": "用户ID",
          "username": "用户名"
        },
        "participants": [
          {
            "user": "用户ID",
            "status": "状态",
            "joinedAt": "加入时间"
          }
        ],
        "tags": ["标签1", "标签2"],
        "createdAt": "创建时间"
      }
    ]
  }
  ```

### 获取单个活动

- **URL**: `/events/:id`
- **方法**: `GET`
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "活动ID",
      "title": "标题",
      "description": "描述",
      "location": "地点",
      "startDate": "开始时间",
      "endDate": "结束时间",
      "category": "分类",
      "image": "图片URL",
      "capacity": 容量,
      "fee": 费用,
      "organizer": {
        "id": "用户ID",
        "username": "用户名"
      },
      "participants": [
        {
          "user": "用户ID",
          "status": "状态",
          "joinedAt": "加入时间"
        }
      ],
      "tags": ["标签1", "标签2"],
      "createdAt": "创建时间"
    }
  }
  ```

### 创建活动

- **URL**: `/events`
- **方法**: `POST`
- **认证**: 需要
- **请求体**:
  ```json
  {
    "title": "标题",
    "description": "描述",
    "location": "地点",
    "startDate": "开始时间",
    "endDate": "结束时间",
    "category": "分类",
    "image": "图片URL",
    "capacity": 容量,
    "fee": 费用,
    "tags": ["标签1", "标签2"]
  }
  ```
- **成功响应** (201):
  ```json
  {
    "success": true,
    "data": {
      "id": "活动ID",
      "title": "标题",
      "description": "描述",
      "location": "地点",
      "startDate": "开始时间",
      "endDate": "结束时间",
      "category": "分类",
      "image": "图片URL",
      "capacity": 容量,
      "fee": 费用,
      "organizer": "用户ID",
      "participants": [],
      "tags": ["标签1", "标签2"],
      "createdAt": "创建时间"
    }
  }
  ```

### 更新活动

- **URL**: `/events/:id`
- **方法**: `PUT`
- **认证**: 需要
- **请求体**: 同创建活动
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "活动ID",
      "title": "标题",
      "description": "描述",
      "location": "地点",
      "startDate": "开始时间",
      "endDate": "结束时间",
      "category": "分类",
      "image": "图片URL",
      "capacity": 容量,
      "fee": 费用,
      "organizer": "用户ID",
      "participants": [
        {
          "user": "用户ID",
          "status": "状态",
          "joinedAt": "加入时间"
        }
      ],
      "tags": ["标签1", "标签2"],
      "createdAt": "创建时间"
    }
  }
  ```

### 删除活动

- **URL**: `/events/:id`
- **方法**: `DELETE`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

### 报名参加活动

- **URL**: `/events/:id/join`
- **方法**: `PUT`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "活动ID",
      "title": "标题",
      "description": "描述",
      "location": "地点",
      "startDate": "开始时间",
      "endDate": "结束时间",
      "category": "分类",
      "image": "图片URL",
      "capacity": 容量,
      "fee": 费用,
      "organizer": "用户ID",
      "participants": [
        {
          "user": "用户ID",
          "status": "状态",
          "joinedAt": "加入时间"
        },
        {
          "user": "当前用户ID",
          "status": "已报名",
          "joinedAt": "加入时间"
        }
      ],
      "tags": ["标签1", "标签2"],
      "createdAt": "创建时间"
    }
  }
  ```

### 取消参加活动

- **URL**: `/events/:id/leave`
- **方法**: `PUT`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "活动ID",
      "title": "标题",
      "description": "描述",
      "location": "地点",
      "startDate": "开始时间",
      "endDate": "结束时间",
      "category": "分类",
      "image": "图片URL",
      "capacity": 容量,
      "fee": 费用,
      "organizer": "用户ID",
      "participants": [
        {
          "user": "用户ID",
          "status": "状态",
          "joinedAt": "加入时间"
        },
        {
          "user": "当前用户ID",
          "status": "已取消",
          "joinedAt": "加入时间"
        }
      ],
      "tags": ["标签1", "标签2"],
      "createdAt": "创建时间"
    }
  }
  ```

## 社区API

### 获取所有社区

- **URL**: `/communities`
- **方法**: `GET`
- **查询参数**:
  - `select`: 选择字段
  - `sort`: 排序字段
  - `page`: 页码
  - `limit`: 每页数量
- **成功响应** (200):
  ```json
  {
    "success": true,
    "count": 数量,
    "pagination": {
      "next": { "page": 下一页, "limit": 每页数量 },
      "prev": { "page": 上一页, "limit": 每页数量 }
    },
    "data": [
      {
        "id": "社区ID",
        "name": "名称",
        "description": "描述",
        "avatar": "头像URL",
        "banner": "横幅URL",
        "category": "分类",
        "creator": {
          "id": "用户ID",
          "username": "用户名"
        },
        "admins": [
          {
            "id": "用户ID",
            "username": "用户名"
          }
        ],
        "members": [
          {
            "user": "用户ID",
            "role": "角色",
            "joinedAt": "加入时间"
          }
        ],
        "isPrivate": 是否私有,
        "tags": ["标签1", "标签2"],
        "createdAt": "创建时间"
      }
    ]
  }
  ```

### 获取单个社区

- **URL**: `/communities/:id`
- **方法**: `GET`
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "社区ID",
      "name": "名称",
      "description": "描述",
      "avatar": "头像URL",
      "banner": "横幅URL",
      "category": "分类",
      "creator": {
        "id": "用户ID",
        "username": "用户名"
      },
      "admins": [
        {
          "id": "用户ID",
          "username": "用户名"
        }
      ],
      "members": [
        {
          "user": "用户ID",
          "role": "角色",
          "joinedAt": "加入时间"
        }
      ],
      "isPrivate": 是否私有,
      "tags": ["标签1", "标签2"],
      "createdAt": "创建时间"
    }
  }
  ```

### 创建社区

- **URL**: `/communities`
- **方法**: `POST`
- **认证**: 需要
- **请求体**:
  ```json
  {
    "name": "名称",
    "description": "描述",
    "avatar": "头像URL",
    "banner": "横幅URL",
    "category": "分类",
    "isPrivate": 是否私有,
    "tags": ["标签1", "标签2"]
  }
  ```
- **成功响应** (201):
  ```json
  {
    "success": true,
    "data": {
      "id": "社区ID",
      "name": "名称",
      "description": "描述",
      "avatar": "头像URL",
      "banner": "横幅URL",
      "category": "分类",
      "creator": "用户ID",
      "admins": ["用户ID"],
      "members": [
        {
          "user": "用户ID",
          "role": "创建者",
          "joinedAt": "加入时间"
        }
      ],
      "isPrivate": 是否私有,
      "tags": ["标签1", "标签2"],
      "createdAt": "创建时间"
    }
  }
  ```

### 更新社区

- **URL**: `/communities/:id`
- **方法**: `PUT`
- **认证**: 需要
- **请求体**: 同创建社区
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "社区ID",
      "name": "名称",
      "description": "描述",
      "avatar": "头像URL",
      "banner": "横幅URL",
      "category": "分类",
      "creator": "用户ID",
      "admins": ["用户ID1", "用户ID2"],
      "members": [
        {
          "user": "用户ID",
          "role": "角色",
          "joinedAt": "加入时间"
        }
      ],
      "isPrivate": 是否私有,
      "tags": ["标签1", "标签2"],
      "createdAt": "创建时间"
    }
  }
  ```

### 删除社区

- **URL**: `/communities/:id`
- **方法**: `DELETE`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

### 加入社区

- **URL**: `/communities/:id/join`
- **方法**: `PUT`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "社区ID",
      "name": "名称",
      "description": "描述",
      "avatar": "头像URL",
      "banner": "横幅URL",
      "category": "分类",
      "creator": "用户ID",
      "admins": ["用户ID1", "用户ID2"],
      "members": [
        {
          "user": "用户ID",
          "role": "角色",
          "joinedAt": "加入时间"
        },
        {
          "user": "当前用户ID",
          "role": "成员",
          "joinedAt": "加入时间"
        }
      ],
      "isPrivate": 是否私有,
      "tags": ["标签1", "标签2"],
      "createdAt": "创建时间"
    }
  }
  ```

### 离开社区

- **URL**: `/communities/:id/leave`
- **方法**: `PUT`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "社区ID",
      "name": "名称",
      "description": "描述",
      "avatar": "头像URL",
      "banner": "横幅URL",
      "category": "分类",
      "creator": "用户ID",
      "admins": ["用户ID1", "用户ID2"],
      "members": [
        {
          "user": "用户ID",
          "role": "角色",
          "joinedAt": "加入时间"
        }
      ],
      "isPrivate": 是否私有,
      "tags": ["标签1", "标签2"],
      "createdAt": "创建时间"
    }
  }
  ```

## 消息API

### 获取用户的所有消息

- **URL**: `/messages`
- **方法**: `GET`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "count": 数量,
    "data": [
      {
        "id": "消息ID",
        "content": "内容",
        "sender": {
          "id": "用户ID",
          "username": "用户名"
        },
        "receiver": {
          "id": "用户ID",
          "username": "用户名"
        },
        "isRead": 是否已读,
        "createdAt": "创建时间"
      }
    ]
  }
  ```

### 获取与特定用户的对话

- **URL**: `/messages/:userId`
- **方法**: `GET`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "count": 数量,
    "data": [
      {
        "id": "消息ID",
        "content": "内容",
        "sender": {
          "id": "用户ID",
          "username": "用户名"
        },
        "receiver": {
          "id": "用户ID",
          "username": "用户名"
        },
        "isRead": 是否已读,
        "createdAt": "创建时间"
      }
    ]
  }
  ```

### 发送消息

- **URL**: `/messages`
- **方法**: `POST`
- **认证**: 需要
- **请求体**:
  ```json
  {
    "receiver": "接收者用户ID",
    "content": "内容"
  }
  ```
- **成功响应** (201):
  ```json
  {
    "success": true,
    "data": {
      "id": "消息ID",
      "content": "内容",
      "sender": "当前用户ID",
      "receiver": "接收者用户ID",
      "isRead": false,
      "createdAt": "创建时间"
    }
  }
  ```

### 删除消息

- **URL**: `/messages/:id`
- **方法**: `DELETE`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

### 标记消息为已读

- **URL**: `/messages/:id/read`
- **方法**: `PUT`
- **认证**: 需要
- **成功响应** (200):
  ```json
  {
    "success": true,
    "data": {
      "id": "消息ID",
      "content": "内容",
      "sender": "发送者用户ID",
      "receiver": "当前用户ID",
      "isRead": true,
      "createdAt": "创建时间"
    }
  }
  ```

## 错误响应

所有API错误响应的格式如下：

```json
{
  "success": false,
  "error": "错误信息"
}
```

常见HTTP状态码：
- 400: 错误请求
- 401: 未授权
- 403: 禁止访问
- 404: 资源未找到
- 500: 服务器错误
