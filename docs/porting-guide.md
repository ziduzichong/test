# 移植方案

## 架构抽象层

当前系统基于 Node.js + Express + SQL.js (SQLite WASM) 构建，前端为原生 HTML/CSS/JS SPA。

```
┌─────────────────────────────────────────┐
│              前端 (SPA)                   │
│  index.html + style.css + app.js        │
│  Hash Router + DOMPurify + Quill (CDN)   │
└────────────────┬────────────────────────┘
                 │ HTTP JSON API
┌────────────────┴────────────────────────┐
│          后端 (Node.js + Express)         │
│  认证模块 / 公告模块 / 成员 / 文件 / 账号  │
└────────────────┬────────────────────────┘
                 │ SQL
┌────────────────┴────────────────────────┐
│          数据层 (SQL.js / SQLite)          │
│  users / announcements / members / files  │
└─────────────────────────────────────────┘
```

## 移植步骤

### 移植到 PostgreSQL

1. **替换数据库驱动**
   ```
   npm uninstall sql.js
   npm install pg
   ```

2. **修改 database.js**
   - 将 `sql.js` 的同步接口改为 `pg` 的异步接口
   - 连接字符串改为 PostgreSQL 格式
   - 日期函数从 `datetime('now','localtime')` 改为 `NOW()`
   - `last_insert_rowid()` 改为 `RETURNING id`

3. **修改建表 SQL**
   - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
   - `TEXT` 保持不变
   - 移除 `IF NOT EXISTS`（或保留）

4. **修改查询方法**
   - sql.js：`db.prepare(sql).bind(params).step()` 循环
   - pg：`pool.query(sql, params)` 直接返回行

### 移植到 MySQL

步骤同 PostgreSQL，区别：
- 驱动使用 `mysql2`
- `AUTOINCREMENT` 改为 `AUTO_INCREMENT`
- 日期函数使用 `NOW()`
- 使用 `mysql2/promise` 的异步接口

### 移植到其他后端语言（Python/Go/Java）

1. **保留 API 接口规范**（JSON 格式不变）
2. **保留数据库表结构**（SQL schema 不变）
3. **重写 server.js 逻辑**
   - 认证模块：session 管理需要对应实现
   - 文件上传：multer → 对应框架的文件处理中间件
   - 速率限制：express-rate-limit → 对应中间件

### 前端框架迁移

如需从原生 JS 迁移到框架：

**迁移到 Vue 3：**
1. 将 `public/index.html` 改为 `index.html` + Vue 挂载点
2. 将 `app.js` 的页面渲染函数改为 `.vue` 单文件组件
3. Hash Router 可用 Vue Router 替代
4. API 客户端可用 axios 替代 fetch

**迁移到 React：**
1. 初始化 React 项目（Vite）
2. 将页面逻辑拆分为组件
3. 使用 react-router-dom 替代 Hash Router
4. Quill 有对应的 react-quill 封装

## 平台差异表

| 功能 | 当前 (SQL.js) | PostgreSQL | MySQL | 说明 |
|------|--------------|-----------|-------|------|
| 驱动 | sql.js | pg | mysql2 | |
| 接口 | 同步 | 异步 | 异步 | |
| 自动递增 | AUTOINCREMENT | SERIAL | AUTO_INCREMENT | |
| 日期默认值 | datetime('now','localtime') | NOW() | NOW() | |
| 最后插入ID | last_insert_rowid() | RETURNING id | last_insert_id | |
| 连接方式 | 文件路径 | TCP连接 | TCP连接 | |
| 并发能力 | <50 | >1000 | >1000 | |

## 依赖替换方案

| 当前 | 可替换选项 | 场景 |
|------|-----------|------|
| Express | Koa / Fastify / Hono | 需要更高性能或不同 API 风格 |
| SQL.js | better-sqlite3 / pg / mysql2 | 需要更高并发或网络数据库 |
| express-session | @fastify/session / JWT | 切换到不同框架或无状态认证 |
| Multer | formidable / busboy | 需要更底层的文件处理 |
| Quill (CDN) | TinyMCE / CKEditor / TipTap | 需要不同编辑器特性 |
| 原生前端 | Vue / React / Svelte | 交互复杂度持续增长 |
