# 工作流程报告

## 设计方案摘要

采用 **Node.js + Express + SQL.js + 原生前端 SPA** 技术路线，构建电子科学与技术协会的对外展示与内部资源共享平台。

- 后端：6大 API 模块（认证、公告、成员、文件、账号、错误处理）
- 前端：Hash Router SPA，公开页面（首页/公告/成员）+ 开发者面板（管理界面）
- 数据库：SQLite 单文件，4 张表（users/announcements/members/files）
- 安全：密码 bcrypt 哈希、httpOnly session、DOMPurify XSS 防护、文件白名单校验

## 技术路线

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 技术栈 | Node.js + Express | 轻量、零运维、小团队友好 |
| 数据库 | SQL.js (SQLite WASM) | 零配置单文件、适合<50并发 |
| 前端 | 原生 HTML/CSS/JS | 无框架依赖、协会成员易维护 |
| 富文本 | Quill.js (CDN) | 功能完善、无需构建工具 |
| 文件存储 | data/uploads/ | 避免 public 直接暴露 |
| 路由方案 | Hash Router | 兼容性好、无需服务端配置 |

## 编码阶段

| 微任务 | 状态 | 说明 |
|-------|------|------|
| 任务1-7 | ✅ 已完成 | 后端 API + 数据库（阶段1-2 中完成） |
| 微任务1/8: index.html | ✅ 已完成 | HTML 骨架 + CDN 资源 |
| 微任务2/8: CSS 样式 | ✅ 已完成 | 237 行，含响应式设计 |
| 微任务3-7/8: app.js | ✅ 已完成 | 825 行，含全部页面、路由、组件 |
| 微任务8/8: 打磨适配 | ✅ 已完成 | 移动端 @media 查询 |

## 审查问题统计

| 问题编号 | 严重程度 | 状态 |
|---------|---------|------|
| P1 (parseInt 安全) | 一般 | ✅ 已修复 |
| P2 (API base) | 建议 | ⏭️ 不采纳 |
| P3 (middleware 拆分) | 建议 | ⏭️ 不采纳 |

## 构建命令日志

```
# 语法检查
node --check server.js       → OK
node --check database.js     → OK
node --check public/js/app.js → OK

# 服务器测试
npm start                    → HTTP 200, 端口 3000

# API 测试
GET  /api/announcements      → 200 (2 items)
GET  /api/members            → 200 (2 items)
GET  /api/auth/session       → 200 (logged_in=false)
POST /api/auth/login         → 200 (ok=true, role=admin)
GET  /api/files (authed)     → 200 (0 items)

# 构建命令
node server.js               → exit code 0
```

## 代码统计

| 文件 | 行数 |
|------|------|
| server.js | 331 |
| database.js | 148 |
| public/index.html | 42 |
| public/css/style.css | 237 |
| public/js/app.js | 825 |
| **总计** | **1583** |
