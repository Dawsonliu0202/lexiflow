# LexiFlow AI

> 网页划词 AI 语境翻译 & 无头生词本自动同步（Chrome 扩展，Manifest V3）

LexiFlow AI 专为开发者日常阅读英文技术文档、资讯及外文网页设计。基于 **WXT + Vue 3 + TypeScript + TailwindCSS + Dexie.js (IndexedDB)** 打造，坚持 **零后端、本地优先、KISS** 原则。

---

## ✨ 核心特性

- **网页划词 & 智能原句提取**：精准捕获选区所在原句（支持缩写、小数点、中英混排与超长居中截断），浮标即时交互。
- **AI 语境释义**：通过兼容 OpenAI 的 Chat Completions 接口流式生成针对【当前原句语境】的确切释义，同时提供核心词义与简明解析。
- **本地优先生词本**：基于 IndexedDB（Dexie.js）实现毫秒级本地收藏反馈，支持查重累加与语境去重。
- **Notion 自动同步**：一键 OAuth 授权，全自动创建并绑定 `LexiFlow Vocabulary` 数据库，页面正文追加 Bullet 语境记录。
- **离线缓冲与智能退避**：支持断网离线收藏，联网自动重试；精准处理 429 限流、401 凭证失效与 404 库解绑等状态。
- **安全与样式隔离**：
  - Shadow DOM 封闭隔离，彻底避免宿主网页样式污染与 CSP 脚本限制。
  - 凭证与密钥仅存放于本地受信存储（`storage.local`），Content Script 无法读取，杜绝泄露。
- **数据导出**：支持导出完整 JSON 备份及防公式注入的 UTF-8 BOM CSV。

---

## 🏗️ 架构概览

```
entrypoints/
  background.ts            # SW 顶层装配: 消息路由、alarms 唤醒、同步引擎
  content/                 # 划词选区检测、原句提取、Shadow Root 卡片挂载
  popup/                   # 手动查词、最近收藏列表、站点划词禁用开关
  options/                 # AI 接口配置、Notion 授权、词库备份导出
components/                # TranslateCard, SyncBadge, WordListItem
services/                  # AI 流式请求、Notion OAuth/DB/Pages、同步引擎、导出
db/                        # Dexie IndexedDB 实例与 WordRepo 事务仓库
messaging/                 # 类型安全 RPC 路由与流式 Port 客户端
platform/                  # Chrome API 适配薄封装
shared/                    # 共享类型、错误模型、日志、工具函数
```

---

## 🚀 快速上手

### 依赖环境
- Node.js >= 18.0.0
- pnpm >= 9.0.0

### 安装依赖
```bash
pnpm install
```

### 开发调试
```bash
pnpm dev
```
启动后会在 `.output/chrome-mv3` 生成扩展产物。打开 Chrome 浏览器访问 `chrome://extensions`，开启右上角「开发者模式」，点击「加载已解压的扩展程序」，选择 `.output/chrome-mv3` 目录即可。

### 自动化测试
```bash
pnpm test
```

### 生产打包
```bash
pnpm build
```

---

## 📄 授权与配置

1. 打开扩展「设置」页：
   - 配置 AI 接口的 Base URL、API Key 与模型名称（如 `gpt-4o-mini`）。
   - 点击「测试连接」验证联通性。
2. （可选）连接 Notion：
   - 在 Notion Integrations 后台创建 Public Integration。
   - 将扩展设置页中显示的固定 Redirect URI 填入 Notion 后台。
   - 填写 Client ID 与 Client Secret，点击「连接 Notion」即可自动建库并开始同步。

---

## 📜 许可证

个人自用项目。
