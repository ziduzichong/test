# 电子科学与技术协会网站 设计文档

## 需求概述

本系统为电子科学与技术协会的对外展示网站与内部资源共享平台。

**普通模式（对外展示面）**：面向潜在社员和外部访客，展示协会风采、课程信息、考核文档、成员/讲师介绍。核心目的是招新宣传和信息公开。

**开发者模式（内部资源共享平台）**：需要账号密码登录。供协会内部成员使用，存储历届项目代码、电路设计、PCB 文件、学习资料、工具链等。核心目的是技术传承、降低学习壁垒、加快新成员上手速度。

数据规模：公告 <1000条，文件 <1000个，单文件 <50MB，并发 <50人。

## 方案对比

| 方案 | 核心思路 | 优点 | 缺点 | 推荐 |
|------|---------|------|------|------|
| Node.js + Express + SQLite + 原生前端 | 轻量全栈 SPA，后端提供 RESTful API，前端 Hash Router 实现无刷新切换，Quill 富文本编辑 | 部署简单（单进程）、SQLite 零配置、前后端分离清晰、内存占用低 | 并发能力有限（适合 <50 人）、无实时推送 | ✅ 推荐 |
| Python Flask + SQLite + Jinja2 模板 | 传统服务端渲染，每次请求返回完整 HTML | 开发快、模板简洁 | 前后端耦合、交互体验差、富文本集成麻烦 | ❌ |
| 纯静态 + GitHub/云盘 | 仅静态页面展示，文件放在第三方云盘 | 零服务器成本 | 无法做权限控制、文件管理不便、数据不安全 | ❌ |

**推荐方案理由**：Node.js + Express 可以在 50 行内启动一个带鉴权的 API 服务器；SQLite 单文件存储无需额外数据库服务；原生前端无框架依赖，协会后续成员可轻松维护。

## 技术栈与依赖

| 组件 | 版本 | 用途 |
|------|------|------|
| Node.js | ≥18 LTS | 运行时 |
| Express | 4.x | HTTP 框架 |
| better-sqlite3 | 11.x | SQLite 同步驱动 |
| express-session | 1.x | 会话管理 |
| connect-sqlite3 | 0.9.x | 会话持久化 |
| Multer | 1.x | 文件上传处理 |
| bcryptjs | 2.x | 密码哈希 |
| Quill | 2.x | 富文本编辑器（CDN） |
| 原生 HTML/CSS/JS | — | 前端（无框架依赖） |

## 模块划分

| 模块 | 职责 | 对外接口 |
|------|------|---------|
| 认证模块 (auth) | 登录/登出/会话检查/权限中间件 | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session` |
| 公告模块 (announcements) | 公告的增删改查，分类（课程/考核/新闻） | `GET /api/announcements`, `POST/PUT/DELETE /api/announcements/:id` |
| 成员模块 (members) | 协会成员/讲师信息管理 | `GET /api/members`, `POST/PUT/DELETE /api/members/:id` |
| 文件模块 (files) | 文件上传/下载/删除/分类管理 | `GET /api/files`, `POST /api/files/upload`, `GET /api/files/download/:id`, `DELETE /api/files/:id` |
| 账号模块 (accounts) | 管理员创建/管理开发者账号 | `GET /api/accounts`, `POST /api/accounts` |
| 前端路由 (router) | Hash 路由，页面切换，公开/认证页面分离 | 客户端 JS，无服务端接口 |

## 接口设计

### 认证
```
POST /api/auth/login
  body: { username, password }
  response: { ok: true, user: { id, username, display_name, role } }

POST /api/auth/logout
  response: { ok: true }

GET /api/auth/session
  response: { logged_in: true, user: {...} } | { logged_in: false }
```

### 公告（公开读取，写需认证）
```
GET /api/announcements?category=course|exam|news
  response: { announcements: [{ id, title, content, category, created_at, updated_at }] }

POST /api/announcements (需认证)
  body: { title, content, category }
  response: { announcement: {...} }

PUT /api/announcements/:id (需认证)
DELETE /api/announcements/:id (需认证)
```

### 成员（公开读取，写需认证）
```
GET /api/members
  response: { members: [{ id, name, position, avatar_url, bio, contact, skills, joined_at }] }

POST /api/members (需认证)
PUT /api/members/:id (需认证)
DELETE /api/members/:id (需认证)
```

### 文件（全部需认证）
```
GET /api/files?category=project|learning|tool
  response: { files: [{ id, original_name, category, description, file_size, created_at }] }

POST /api/files/upload (multipart, 需认证)
  body: { file, category, description }
  response: { file: {...} }

GET /api/files/download/:id (需认证)
  response: 文件流

DELETE /api/files/:id (需认证)
```

### 账号（需认证 + admin 角色）
```
GET /api/accounts (需认证+admin)
  response: { accounts: [{ id, username, display_name, role, created_at }] }

POST /api/accounts (需认证+admin)
  body: { username, password, display_name, role }
  response: { account: {...} }
```

## 数据流

```
访客访问网站
  → 浏览器加载 index.html
  → 前端 JS 解析 URL hash (#/home, #/announcements, #/members)
  → 调用公开 API 获取数据
  → 渲染页面

开发者登录
  → POST /api/auth/login
  → 成功后获取 session cookie
  → 前端切换到开发者视图（显示文件管理、编辑入口）
  → 所有写操作携带 cookie 通过中间件鉴权

文件上传
  → 开发者选择文件 + 分类 + 描述
  → POST multipart/form-data → Multer 中间件处理
  → 文件存入 public/uploads/<category>/
  → 文件元信息写入数据库
  → 开发者可通过文件列表下载
```

## 验收标准

| # | 标准 | 验证方式 |
|---|------|---------|
| 1 | 未登录用户可查看公告列表和详情 | 打开页面，点击公告，内容正常显示 |
| 2 | 未登录用户可查看成员列表和详情 | 打开页面，点击成员，信息正常显示 |
| 3 | 未登录用户看不到文件/编辑/管理入口 | 检查导航栏无开发者相关菜单 |
| 4 | 正确账号密码可登录 | 输入 test/admin 测试账号，登录成功 |
| 5 | 错误密码登录失败并提示 | 输入错误密码，显示错误提示 |
| 6 | 登录后可发布/编辑/删除公告 | 新建公告→保存→确认显示→编辑→保存→删除 |
| 7 | 登录后可上传/下载/删除文件 | 上传文件→列表出现→下载→文件内容正确→删除 |
| 8 | 登录后可编辑成员信息 | 修改成员→保存→公开页面刷新确认 |
| 9 | 管理员可创建新账号 | 创建账号→新账号可登录 |
| 10 | 公告支持富文本编辑并正确渲染 | 编辑时加粗/插入图片→保存→公开页面显示格式正确 |
| 11 | 文件上传限制 50MB | 上传 >50MB 文件被拒绝并有提示 |

## 风险与约束

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 文件存储无备份 | 服务器故障导致资料丢失 | 在文档中说明定期备份 uploads/ 和数据库文件 |
| 单点登录失窃 | session cookie 泄露导致未授权访问 | 使用 httpOnly cookie，后续可加 HTTPS |
| 富文本 XSS | 恶意脚本通过富文本注入 | Quill 默认输出 HTML，前端渲染用 innerHTML 前做 sanitize；服务端存储不做过滤（信任已登录开发者） |
| 并发写入 | SQLite 写入锁冲突 | better-sqlite3 为同步驱动，单进程中写操作串行化，50 并发以下无问题 |
