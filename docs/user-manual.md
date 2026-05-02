# 使用手册

## 系统要求

- Node.js ≥ 18 LTS
- npm ≥ 9
- 操作系统：Windows / macOS / Linux
- 内存：≥ 256MB（推荐 512MB）
- 磁盘：≥ 1GB 可用空间（含文件存储）

## 安装步骤

1. 确保已安装 Node.js：
```bash
node --version
```

2. 进入项目目录并安装依赖：
```bash
cd D:\网站测试
npm install
```

3. 启动服务器：
```bash
npm start
```

4. 浏览器打开 `http://localhost:3000`

## 快速入门

### 公开浏览

1. 打开网站首页，可查看协会简介和最新公告预览
2. 点击顶部导航「公告」查看全部公告列表
3. 点击公告卡片进入详情页，支持富文本格式展示
4. 点击「成员」查看协会成员卡片

### 开发者登录

1. 点击导航栏「登录」
2. 输入管理员账号：`admin` / 密码：`admin123`
3. 登录成功后导航栏出现「管理面板」入口

### 管理公告

1. 进入「管理面板 → 公告管理」
2. 点击「新建公告」打开编辑器
3. 输入标题、选择分类（新闻/课程/考核）
4. 使用富文本编辑器编写内容（支持加粗、列表、图片等）
5. 点击「保存」发布

### 管理文件

1. 进入「管理面板 → 文件管理」
2. 点击「上传文件」
3. 选择分类（学习资料/项目代码/工具链）
4. 拖拽文件到上传区域或点击选择文件
5. 添加描述后点击「上传」
6. 在文件列表中可下载或删除文件

### 管理成员

1. 进入「管理面板 → 成员管理」
2. 点击「添加成员」填写姓名、职位、简介等信息
3. 技能用逗号分隔，如：STM32, PCB设计, 嵌入式开发
4. 保存后成员将在首页和成员页展示

### 管理账号（管理员专用）

1. 进入「管理面板 → 账号管理」
2. 点击「创建账号」输入用户名、密码、显示名
3. 选择角色：编辑者（可管理内容）或管理员（可管理账号）

## 功能详解

### 前端路由

网站使用 Hash 路由，所有页面无需刷新：

| 路由 | 页面 | 权限 |
|------|------|------|
| `#/home` | 首页 | 公开 |
| `#/announcements` | 公告列表 | 公开 |
| `#/announcement/:id` | 公告详情 | 公开 |
| `#/members` | 成员列表 | 公开 |
| `#/member/:id` | 成员详情 | 公开 |
| `#/login` | 登录页 | 公开 |
| `#/dashboard` | 管理面板 | 需登录 |
| `#/logout` | 退出登录 | 需登录 |

### API 接口

所有 API 返回统一格式：`{ ok: boolean, data?: any, error?: string }`

公开接口（无需认证）：
- `GET /api/announcements?category=&page=&limit=`
- `GET /api/members?page=&limit=`
- `GET /api/auth/session`

认证接口（需 session cookie）：
- `POST /api/auth/login` `POST /api/auth/logout`
- `POST/PUT/DELETE /api/announcements/:id`
- `POST/PUT/DELETE /api/members/:id`
- `GET/POST /api/files` `GET /api/files/download/:id` `DELETE /api/files/:id`

管理员接口（需 admin 角色）：
- `GET/POST /api/accounts`

### 富文本编辑器

公告编辑器基于 Quill.js 构建，支持：
- 文字格式：加粗、斜体、下划线、删除线
- 段落格式：标题、有序/无序列表、引用、代码块
- 多媒体：图片插入、链接
- 所有内容经过 DOMPurify 清洗防止 XSS

### 文件上传

- 单文件最大 50MB
- 支持常见文档、图片、压缩包、代码文件
- 白名单扩展名校验
- 文件通过 API 代理下载（不直接暴露存储路径）

## 配置项说明

目前配置项集中在 `server.js` 文件顶部：

| 配置 | 位置 | 默认值 | 说明 |
|------|------|--------|------|
| PORT | server.js:13 | 3000 | 服务端口 |
| session secret | server.js:26 | 'esta-website-secret-key-2026' | 会话加密密钥 |
| session maxAge | server.js:29 | 12 小时 | 登录会话有效期 |
| upload limit | server.js:80 | 50MB | 单文件上传上限 |
| login rate limit | server.js:34 | 10次/分钟 | 登录接口速率限制 |

## 常见故障排除

| 问题 | 原因 | 解决 |
|------|------|------|
| 启动报错 `Cannot find module` | 依赖未安装 | 运行 `npm install` |
| 数据库错误 `SQLITE_BUSY` | 并发写入冲突 | SQLite 限制，<50 并发正常 |
| 登录后仍提示未登录 | 浏览器禁用了 Cookie | 允许本站 Cookie |
| 文件上传失败 | 超过 50MB 或文件类型不支持 | 检查文件大小和类型 |
| 富文本不显示 | CDN 资源被拦截 | 检查网络连接，Quill.js 从 CDN 加载 |
