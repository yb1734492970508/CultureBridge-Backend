const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'CultureBridge API',
            version: '2.0.0',
            description: 'CultureBridge 文化交流平台 API 文档',
            contact: {
                name: 'CultureBridge Team',
                email: 'support@culturebridge.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: '开发环境'
            },
            {
                url: 'https://api.culturebridge.com',
                description: '生产环境'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: '用户ID'
                        },
                        username: {
                            type: 'string',
                            description: '用户名'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: '邮箱地址'
                        },
                        avatar: {
                            type: 'string',
                            description: '头像URL'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: '创建时间'
                        }
                    }
                },
                ChatRoom: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: '聊天室ID'
                        },
                        name: {
                            type: 'string',
                            description: '聊天室名称'
                        },
                        description: {
                            type: 'string',
                            description: '聊天室描述'
                        },
                        type: {
                            type: 'string',
                            enum: ['PUBLIC', 'PRIVATE', 'LANGUAGE_EXCHANGE', 'CULTURAL_DISCUSSION'],
                            description: '聊天室类型'
                        },
                        category: {
                            type: 'string',
                            enum: ['GENERAL', 'LANGUAGE_LEARNING', 'CULTURAL_EXCHANGE', 'BUSINESS'],
                            description: '聊天室分类'
                        },
                        creator: {
                            $ref: '#/components/schemas/User'
                        },
                        participants: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    user: {
                                        $ref: '#/components/schemas/User'
                                    },
                                    role: {
                                        type: 'string',
                                        enum: ['MEMBER', 'VIP', 'MODERATOR', 'ADMIN']
                                    },
                                    joinedAt: {
                                        type: 'string',
                                        format: 'date-time'
                                    }
                                }
                            }
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                ChatMessage: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: '消息ID'
                        },
                        chatRoom: {
                            type: 'string',
                            description: '聊天室ID'
                        },
                        sender: {
                            $ref: '#/components/schemas/User'
                        },
                        type: {
                            type: 'string',
                            enum: ['TEXT', 'VOICE', 'IMAGE', 'FILE', 'SYSTEM'],
                            description: '消息类型'
                        },
                        content: {
                            type: 'object',
                            properties: {
                                text: {
                                    type: 'string',
                                    description: '文本内容'
                                },
                                voiceUrl: {
                                    type: 'string',
                                    description: '语音文件URL'
                                },
                                imageUrl: {
                                    type: 'string',
                                    description: '图片URL'
                                },
                                fileUrl: {
                                    type: 'string',
                                    description: '文件URL'
                                }
                            }
                        },
                        translations: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    language: {
                                        type: 'string',
                                        description: '目标语言'
                                    },
                                    text: {
                                        type: 'string',
                                        description: '翻译文本'
                                    },
                                    confidence: {
                                        type: 'number',
                                        description: '翻译置信度'
                                    }
                                }
                            }
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                CBTWallet: {
                    type: 'object',
                    properties: {
                        userId: {
                            type: 'string',
                            description: '用户ID'
                        },
                        balance: {
                            type: 'string',
                            description: 'CBT余额'
                        },
                        walletAddress: {
                            type: 'string',
                            description: '钱包地址'
                        },
                        totalEarned: {
                            type: 'string',
                            description: '总收入'
                        },
                        totalSpent: {
                            type: 'string',
                            description: '总支出'
                        }
                    }
                },
                TranslationResult: {
                    type: 'object',
                    properties: {
                        originalText: {
                            type: 'string',
                            description: '原始文本'
                        },
                        translatedText: {
                            type: 'string',
                            description: '翻译文本'
                        },
                        sourceLanguage: {
                            type: 'string',
                            description: '源语言'
                        },
                        targetLanguage: {
                            type: 'string',
                            description: '目标语言'
                        },
                        confidence: {
                            type: 'number',
                            description: '翻译置信度'
                        }
                    }
                },
                ApiResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: '请求是否成功'
                        },
                        message: {
                            type: 'string',
                            description: '响应消息'
                        },
                        data: {
                            type: 'object',
                            description: '响应数据'
                        },
                        error: {
                            type: 'string',
                            description: '错误信息'
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        error: {
                            type: 'string',
                            description: '错误信息'
                        }
                    }
                }
            }
        },
        security: [
            {
                bearerAuth: []
            }
        ]
    },
    apis: [
        './src/routes/*.js',
        './src/models/*.js'
    ]
};

const specs = swaggerJsdoc(options);

module.exports = {
    specs,
    swaggerUi,
    setupSwagger: (app) => {
        // Swagger UI 路由
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
            explorer: true,
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'CultureBridge API 文档'
        }));
        
        // JSON 格式的 API 文档
        app.get('/api-docs.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(specs);
        });
        
        console.log('📚 API文档已启用: http://localhost:3000/api-docs');
    }
};

