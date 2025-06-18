## 项目架构分析总结

### 后端 (CultureBridge-Backend)

*   **技术栈**: Node.js, Express.js, MongoDB (通过 Mongoose), JWT (认证), Socket.IO (实时通信)。
*   **入口文件**: `src/enhancedApp.js`。该文件负责初始化 Express 应用、连接 MongoDB、启动翻译服务、语音翻译服务和 Socket.IO 服务，并加载所有 API 路由。
*   **路由**: 后端包含丰富的路由，涵盖用户认证、个人资料、话题、帖子、评论、资源、活动、社区、消息、聊天、语音、文化交流、语言学习、翻译和奖励等多个模块，表明其功能非常全面。
*   **服务**: 提供了 `EnhancedSocketService` (实时聊天和通知), `EnhancedTranslationService` (文本翻译) 和 `EnhancedVoiceTranslationService` (语音翻译) 等核心服务。
*   **数据模型**: 存在多种数据模型，如 `User`, `UserReward`, `ChatMessage`, `Post`, `Comment`, `Profile`, `Topic`, `Resource`, `Event`, `Community`, `Message`, `CulturalExchange`, `LanguageLearningProgress`, `LanguageLearningSession`, `VoiceTranslation` 等，支持平台的多样化功能。
*   **区块链化移除**: 已确认所有与区块链相关的代码和功能已从后端项目中彻底移除，项目已转变为中心化平台。

### 前端 (CultureBridge-Frontend1)

*   **技术栈**: React.js, `react-router-dom` (路由), `axios` (API 请求), `socket.io-client` (实时通信)。
*   **入口文件**: `src/index.js`。负责渲染主要的 `App` 组件，并配置了 React 路由。
*   **依赖**: 包含了 `@mui/material`, `@ant-design/icons`, `@emotion/react`, `framer-motion`, `recharts`, `chart.js` 等 UI 库，表明前端具有丰富的交互和数据可视化能力。
*   **与后端交互**: 通过 `axios` 发送 HTTP 请求调用后端 RESTful API，并通过 `socket.io-client` 与后端建立 WebSocket 连接，实现实时功能。

### 整体架构

CultureBridge 项目采用典型的客户端-服务器架构。React 前端通过 RESTful API 和 WebSocket 与 Node.js/Express 后端进行通信，后端则使用 MongoDB 进行数据持久化。项目“去区块链化”后，我们可以专注于构建一个功能完善的中心化文化交流学习平台。

### 移动应用开发方向

基于现有架构，移动应用原型开发应着重实现以下核心功能：

*   **用户认证与管理**: 注册、登录、登出、个人资料查看与编辑。
*   **内容浏览与发布**: 查看话题、帖子、评论，并支持用户发布内容。
*   **实时聊天**: 利用 Socket.IO 实现即时通讯功能。
*   **语言学习与文化交流**: 适配现有的语言学习课程和文化交流活动功能。
*   **API 消费**: 移动应用将直接调用后端提供的现有 API 接口。
*   **UI/UX 适配**: 尽管前端是 React，但移动应用需要针对 React Native 或 Expo 进行 UI/UX 的重新设计和组件适配，以提供原生体验。

