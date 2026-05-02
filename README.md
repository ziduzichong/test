# ⚡ 电子科学与技术协会网站

对外展示与内部资源共享平台，面向高校电子科学与技术协会。

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务器
npm start

# 开发模式（文件修改自动重启）
npm run dev
```

启动后访问 `http://localhost:3000`。

默认管理员账号：`admin` / `admin123`（首次登录后请修改密码）

## 项目结构

```
├── server.js            # Express 服务器 + 全部 API 路由
├── database.js          # SQLite 数据库（建表、种子数据、查询方法）
├── package.json         # 项目配置与依赖
├── data/
│   ├── esta.db          # SQLite 数据库文件（Git 忽略）
│   └── uploads/         # 上传文件存储（按分类分目录）
├── public/
│   ├── index.html       # SPA 入口页面
│   ├── css/style.css    # 样式系统
│   └── js/app.js        # 前端应用（Hash Router、API 客户端、页面渲染）
├── docs/
│   ├── design/          # 设计文档
│   └── reports/         # 工作流报告、审查报告、构建日志
└── middleware/          # 预留中间件目录（当前内联在 server.js）
```

## 技术栈

| 组件 | 用途 |
|------|------|
| Node.js | 运行时 |
| Express | HTTP 框架 |
| SQL.js (SQLite WASM) | 数据库，零配置单文件存储 |
| express-session | 会话管理 |
| Multer | 文件上传 |
| bcryptjs | 密码哈希 |
| Quill.js (CDN) | 富文本编辑器 |
| DOMPurify (CDN) | XSS 防护 |

## 功能特性

### 公开区域（无需登录）
- 首页 — 协会简介、最新公告、成员展示
- 公告列表/详情 — 分类浏览（新闻/课程/考核），富文本渲染
- 成员展示 — 成员卡片网格展示

### 开发者区域（需登录）
- **公告管理** — 创建/编辑/删除公告，支持富文本编辑
- **成员管理** — 添加/编辑/删除协会成员信息
- **文件管理** — 上传/下载/删除文件，按分类管理，支持拖拽上传
- **账号管理**（管理员）— 创建新账号，分配角色

## FAQ

**Q: 部署需要什么环境？**
A: 仅需 Node.js ≥18 LTS，npm 安装依赖后即可运行。无需数据库服务。

**Q: 如何备份数据？**
A: 备份 `data/esta.db`（数据库）和 `data/uploads/`（上传文件）两个目录。

**Q: 如何修改默认管理员密码？**
A: 登录后在管理面板中暂无密码修改功能，可直接操作数据库使用 bcrypt 生成新哈希。

**Q: 并发量支持多少？**
A: SQLite 适合 <50 并发场景。如需更高并发，可迁移至 PostgreSQL。

## License

MIT
