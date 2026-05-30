# 电子科学与技术协会网站 — 架构文档（Python / Django 版）

## 1. 项目定位

高校电子科学与技术协会对外展示与内部资源共享平台。服务对象：
- **访客**：准新生、外校人员 → 查看协会风采、获奖、成员信息
- **协会成员（已登录）**：上传/下载资料、编辑公告、管理成员
- **管理员（唯一）**：最高权限，唯一可批量删除文件的人

## 2. 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 语言 | Python 3.12+ | 大学通用教学语言，换届门槛最低 |
| 框架 | Django 5.0 LTS | 电池全含：ORM、认证、Admin、迁移，开箱即用 |
| 数据库 | SQLite → PostgreSQL | 本地部署用 SQLite 零配置；上 NAS 后一键切 PostgreSQL |
| 前端 | Django Templates + HTMX + Alpine.js | 服务端渲染为主，少量交互用 Alpine.js；无需 Webpack/Node |
| 富文本 | django-ckeditor-5 | 公告编辑器，图片上传内置 |
| 文件存储 | Django Storage API | 本地文件系统 → NAS 挂载路径，改一行配置即可 |
| 文件分片上传 | django-chunked-upload | 大文件（视频/安装包）分片上传，支持断点续传 |
| 文件校验 | python-magic | 魔术字校验，防止扩展名伪装 |
| 搜索 | SQLite FTS5 / Django icontains | 文件/公告全文搜索，无需外部搜索引擎 |
| 部署 | Docker + Gunicorn | 一条 `docker compose up` 在任何机器上启动 |
| 静态资源 | WhiteNoise | 内置在 Django 里，不需要 nginx |

### 为什么不选 Flask？
Flask 和 Express 一样是微框架：需要手写认证、Admin、ORM 迁移。Django 这些全是内置的，少写 60% 代码，长期维护成本更低。

## 3. 系统架构

```
┌─────────────────────────────────────────────────┐
│                    浏览器                         │
│         (HTML + HTMX + Alpine.js)                │
└─────────────────┬───────────────────────────────┘
                  │ HTTPS (后期加域名 + Caddy)
┌─────────────────▼───────────────────────────────┐
│               Caddy / Nginx                       │
│          (反向代理 + 静态文件 + 自动HTTPS)         │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│           Gunicorn (WSGI Server)                  │
│              Django 5.0 LTS                       │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │ accounts │announce- │ members  │  awards  │  │
│  │  (认证)  │  ments   │ (成员)   │ (奖项)   │  │
│  │          │ (公告)   │          │          │  │
│  ├──────────┼──────────┼──────────┼──────────┤  │
│  │  files   │  core    │  api     │  admin   │  │
│  │ (文件)   │ (主页)   │ (可选)   │ (管理)   │  │
│  └──────────┴──────────┴──────────┴──────────┘  │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│          Storage Layer                            │
│  ┌──────────────────┐  ┌────────────────────┐   │
│  │  SQLite / PG     │  │  File System / NAS │   │
│  │  (结构化数据)     │  │  (上传文件)         │   │
│  └──────────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**核心设计原则**：
- **单体应用，模块分离** — 一个 Django 项目，按功能拆成 6 个 app，换届的人只需看懂自己修改的那个 app
- **服务端渲染为主** — 不用前后端分离 SPA，减少 JS 代码量
- **配置外置** — 所有敏感信息走环境变量，代码里不留密钥

## 4. 数据模型

### 4.1 用户 (accounts.User)

继承 Django AbstractUser，扩展字段：

```
User (AbstractUser)
├── username        CharField       登录用户名
├── password        (Django内置)     bcrypt 哈希
├── display_name    CharField       显示名称
├── role            CharField       角色: admin / editor
│   └── admin:  唯一管理员，可批量删除文件、创建账号
│   └── editor: 普通成员，可上传下载、编辑公告
├── is_active       BooleanField    软禁用
├── date_joined     DateTimeField
└── last_login      DateTimeField
```

### 4.2 公告 (announcements.Announcement)

```
Announcement
├── title           CharField       标题 (≤200字)
├── content         TextField       富文本内容 (CKEditor)
├── category        CharField       分类: news / course / exam
├── is_published    BooleanField    发布/草稿 (默认草稿)
├── author          FK → User       创建时自动填充 request.user
├── created_at      DateTimeField   auto_now_add
└── updated_at      DateTimeField   auto_now
```

### 4.3 成员 (members.Member)

```
Member
├── name            CharField       姓名
├── position        CharField       职位 (会长/技术部长/...)
├── avatar          ImageField      头像 (可选)
├── bio             TextField       个人简介
├── contact         CharField       联系方式
├── contact_public  BooleanField    是否对外公开联系方式 (默认否)
├── skills          CharField       技能标签 (逗号分隔)
├── joined_at       CharField       加入时间 (如 2024-09)
├── order           IntegerField    排序 (数字越小越靠前)
├── is_active       BooleanField    是否展示
├── created_at      DateTimeField
└── updated_at      DateTimeField
```

### 4.4 奖项 (awards.Award)

```
Award
├── title           CharField       奖项名称
├── description     TextField       描述
├── competition     CharField       竞赛名称
├── rank            CharField       等级: 特等奖 / 一等奖 / 二等奖 / 三等奖 / 优胜奖
├── award_date      DateField       获奖日期
├── members         M2M → Member    获奖成员 (多对多)
├── image           ImageField      证书/现场照片 (可选)
├── order           IntegerField    排序
├── created_at      DateTimeField
└── updated_at      DateTimeField
```

### 4.5 文件 (files.UploadedFile)

```
UploadedFile
├── file            FileField       文件本身 (Storage API 管理)
├── original_name   CharField       原始文件名
├── category        CharField       分类: learning / project / circuit / firmware / video / tool / installer
├── description     CharField       文件描述 (可选)
├── sha256_hash     CharField       SHA256 校验值 (可执行文件必填，其他选填)
├── uploader        FK → User       (可为空)
├── file_size       BigIntegerField 字节数
├── download_count  IntegerField    下载次数 (默认0)
├── created_at      DateTimeField
└── updated_at      DateTimeField
```

**文件分类说明**：

| 分类 | 用途 | 允许扩展名 | 大小上限 |
|------|------|-----------|---------|
| learning | 课程文档/资料 | pdf, doc, docx, ppt, pptx, xls, xlsx, txt, md, csv | 100MB |
| project | 项目代码 | c, cpp, h, hpp, py, rs, go, java, js, ts, v, sv, ino, asm, zip, rar, 7z | 100MB |
| circuit | 电路设计 | sch, pcb, brd, json(EasyEDA), epro, prjpcb | 100MB |
| firmware | 固件/烧录文件 | hex, bin, elf, uf2 | 100MB |
| video | 教学视频 | mp4, mov, avi, mkv, webm | 2GB |
| tool | 软件/工具链 | exe, msi, apk, deb, rpm, dmg, tar, gz | 2GB |
| installer | 系统镜像/安装包 | iso, img | 2GB |

> 可执行文件 (exe, msi, apk 等) 上传时必须填写 SHA256 校验值，下载页展示校验值供验证。

## 5. 权限模型

```
                    访客      登录用户    管理员
                    (匿名)    (editor)   (admin)
查看公告              ✅        ✅         ✅
查看成员(非敏感)      ✅        ✅         ✅
查看成员联系方式      ❌*       ✅         ✅
查看奖项              ✅        ✅         ✅
查看文件列表          ❌        ✅         ✅
下载文件              ❌        ✅         ✅
上传文件              ❌        ✅         ✅
创建/编辑公告         ❌        ✅         ✅
删除公告              ❌        ❌         ✅
添加/编辑成员         ❌        ✅         ✅
删除成员              ❌        ❌         ✅
创建账号              ❌        ❌         ✅
删除单个文件          ❌        ❌         ✅
批量删除文件          ❌        ❌         ✅ (仅管理员)
访问 Django Admin     ❌        ❌         ✅ (仅管理员)
```

> `*` 成员可设置 `contact_public=True` 使联系方式对访客可见

权限实现：Django 的 `@login_required` + `@user_passes_test` 装饰器 + 自定义 `@require_admin`。

> **Member ≠ User**：Member 是对外展示的协会名片（可包含已毕业前辈），User 是当前有登录权限的管理者。两者独立存储。User 是操作者（谁在管理网站），Member 是展示对象（协会有哪些人）。换届时只需要修改 User 账号，Member 数据保留作为历史记录。

## 6. 路由设计

```
# 公开页面
/                      首页 (公告摘要 + 成员展示 + 奖项轮播)
/announcements/        公告列表 (分页，分类筛选)
/announcements/<id>/   公告详情
/members/              成员列表
/members/<id>/         成员详情
/awards/               奖项列表
/login/                登录页

# 需登录
/dashboard/            管理面板首页
/dashboard/files/      文件管理
/dashboard/files/upload/  上传文件
/dashboard/announcements/  公告管理
/dashboard/members/    成员管理
/dashboard/awards/     奖项管理

# 管理员专用
/dashboard/accounts/   账号管理
/dashboard/files/batch-delete/  批量删除文件

# 搜索
/search/               全局搜索 (文件 + 公告，需登录)

# 文件下载 (需登录)
/files/<id>/download/  文件下载 (记录下载次数)

# API (HTMX 用的局部刷新接口，需登录)
/api/files/<id>/delete/
/api/announcements/<id>/toggle-publish/
```

## 7. 安全设计

### 7.1 防护措施总览

| 措施 | 实现方式 |
|------|---------|
| 密码哈希 | Django 内置 PBKDF2 + bcrypt fallback |
| 会话管理 | Django session + HttpOnly + Secure cookie；`SESSION_COOKIE_AGE=7200`（2小时） |
| CSRF 防护 | Django 内置 CSRF 中间件；生产环境 `CSRF_COOKIE_SECURE=True` |
| XSS 防护 | Django 模板自动转义 + CKEditor 内容白名单 |
| SQL 注入 | Django ORM 参数化查询，无手写 SQL |
| 登录限流 | django-axes（5次失败锁定15分钟） |
| 密钥管理 | 所有密钥/密码走环境变量，代码不提交 |
| HTTPS | Caddy 自动 Let's Encrypt；HSTS `max-age=63072000; includeSubDomains; preload` |
| 安全头 | Caddy 统一注入：`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: strict-origin-when-cross-origin` |

### 7.2 文件上传安全（三层校验）

```
第1层 — 扩展名白名单 (files/validators.py)
  → 拒绝不在白名单的扩展名

第2层 — MIME 类型校验
  → Django FileField 默认检查 Content-Type

第3层 — 魔术字校验 (python-magic)
  → 读取文件头 256 字节，比对真实类型
  → 例：改名为 notes.pdf 的 virus.exe，魔术字 0x4D5A 暴露其为 PE 可执行文件
  → 拒绝 MIME 与魔术字不匹配的文件
```

### 7.3 文件下载鉴权（防绕过）

**问题**：生产环境若 Caddy/Nginx 直接服务 `/media/` 路径，未登录用户可通过 URL 直接下载文件，绕过 Django 登录检查。

**解决**：使用 Caddy `internal` 路由 + Django `X-Accel-Redirect` 机制：

```caddy
# Caddyfile — 禁止外部直接访问 /protected/
handle /protected/* {
    internal
}

# 正常请求走 Django
handle {
    reverse_proxy app:8000
}
```

```python
# files/views.py — Django 下载视图
@login_required
def download_file(request, file_id):
    obj = UploadedFile.objects.get(id=file_id)
    # 返回 X-Accel-Redirect 头，Caddy 识别后从 internal 路径返回文件
    response = HttpResponse()
    response["X-Accel-Redirect"] = f"/protected/{obj.file.name}"
    response["Content-Disposition"] = f'attachment; filename="{obj.original_name}"'
    obj.download_count += 1
    obj.save()
    return response
```

> 开发环境（`DEBUG=True`）直接用 Django 服务文件，无需此配置。

### 7.4 可执行文件安全

- 上传 `exe, msi, apk, deb, rpm` 等可执行文件时，**强制要求填写 SHA256 校验值**
- 下载页展示校验值，用户可自行验证文件完整性
- 该类文件仅管理员可删除，普通用户不可覆盖

### 7.5 Django Admin 安全

- 仅 `role=admin` 用户可访问 `/admin/`
- Admin 中仅注册必要模型，使用 `has_delete_permission` 限制批量删除
- 普通 `editor` 用户无 Admin 访问权限（代码强制，不止是前端隐藏）

## 8. 部署方案

### 8.1 本地/单机部署 (当前)

```
docker compose up -d
```

- Gunicorn 8 workers × 2 threads（支持 300+ 并发）
- SQLite (挂载到宿主机目录)
- 上传文件存储在宿主机目录 (挂载 volume)

### 8.2 NAS 部署 (后续)

**docker-compose.nas.yml 结构**：

```yaml
services:
  db:
    image: postgres:16
    restart: always
    volumes:
      - /mnt/nas/esta/db:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: esta
      POSTGRES_USER: esta
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  app:
    build: .
    restart: always
    depends_on:
      - db
    volumes:
      - /mnt/nas/esta/uploads:/app/media/uploads
      - /mnt/nas/esta/static:/app/staticfiles
    environment:
      DATABASE_URL: postgres://esta:${DB_PASSWORD}@db:5432/esta
      SECRET_KEY: ${SECRET_KEY}
      DEBUG: "False"
      ALLOWED_HOSTS: ${DOMAIN},localhost
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn config.wsgi:application -w 8 --threads 2 --worker-class gthread -b 0.0.0.0:8000"

  caddy:
    image: caddy:2
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - /mnt/nas/esta/uploads:/protected:ro  # 只读挂载，供 internal 路由使用
```

迁移步骤：
1. NAS 上装 Docker + Docker Compose
2. 复制项目文件夹到 NAS（如 `/volume1/docker/esta-website/`）
3. 创建 `/mnt/nas/esta/` 下的 `db/`、`uploads/`、`static/` 目录
4. 编辑 `.env`：设置 `DB_PASSWORD`、`SECRET_KEY`、`DOMAIN`
5. `docker compose -f docker-compose.nas.yml up -d`
6. 创建管理员：`docker compose -f docker-compose.nas.yml exec app python manage.py createsuperuser`
7. 数据迁移（从旧 SQLite）：`python manage.py dumpdata` 导出 → 在 NAS PostgreSQL 环境 `python manage.py loaddata` 导入

### 8.3 生产环境必做：静态资源收集

Django 开发模式自动服务静态文件，生产环境必须执行：

```bash
python manage.py collectstatic --noinput
```

此命令将所有静态文件（CSS/JS/图片）收集到 `STATIC_ROOT`（如 `staticfiles/`），由 WhiteNoise 或 Caddy 高效服务。

### 8.4 存储估算与策略

**关键认知：SQLite 只存元数据，文件存在文件系统上。**

```
数据分布估算（假设 10,000 个文件，总计 50GB）：
─────────────────────────────────────────────
SQLite 数据库        ~2MB      (每条文件记录 ~200字节 × 10,000)
media/uploads/      ~50GB     (实际文件)
─────────────────────────────────────────────
总计磁盘需求         ~50GB + 系统开销

即使 100,000 个文件：
SQLite 数据库        ~20MB     (仍然很小)
media/uploads/      ~500GB+
```

**数据库永远不会成为瓶颈。存储瓶颈在磁盘空间。**

```
存储路径：
开发阶段:
  data/db.sqlite3          # 数据库 ~几MB
  media/uploads/           # 所有上传文件 ~几十GB

NAS阶段:
  /mnt/nas/esta/db/        # 数据库
  /mnt/nas/esta/uploads/   # 文件
  /mnt/nas/esta/backups/   # 备份

磁盘规划建议：
  初始分配: 100GB (覆盖首期 50GB + 余量)
  年增长:   ~20-50GB (课程资料、新软件包)
  NAS建议:  500GB+ 可用空间
```

Django 的 `DEFAULT_FILE_STORAGE` 切换路径只需改一行配置。

### 8.5 初始批量导入（几十GB数据一次性上传）

**不通过网页上传。** 几十GB 通过浏览器上传会超时、断连、且无法续传。

正确做法：直接放到服务器文件系统 → 运行管理命令注册到数据库。

```bash
# 1. 将初始文件放到临时目录
scp -r /your/local/files/ server:/tmp/esta-import/

# 2. 运行批量导入命令
python manage.py bulk_import /tmp/esta-import/ --category learning

# 这条命令自动：
#   - 扫描目录下所有文件
#   - 根据扩展名自动分类
#   - 计算 SHA256
#   - 复制/移动到 media/uploads/
#   - 批量写入数据库（单事务，快）
#   - 输出导入统计
```

具体操作见 `docs/bulk-data-guide.md`。

## 9. 备份策略

> **为什么不推荐 `dumpdata`**：JSON 导出对二进制文件记录无效（文件本身不会进 JSON）、大表导出极慢、且 JSON 无法跨数据库类型可靠恢复。直接复制数据库文件是最可靠的方案。

### 9.1 备份策略（适用于大规模文件）

> 媒体文件 >10GB 后，tar.gz 全量压缩不现实（50GB 压缩需数小时）。采用分级备份。

**分级备份方案**：

```
第1级 — 数据库备份（每天，秒级完成）
  复制 db.sqlite3 三文件 → ~几MB，1秒完成

第2级 — 媒体文件增量备份（每天，只传变化的文件）
  rsync -a media/uploads/ backups/latest/uploads/

第3级 — 完整快照（每周，或需要时）
  rsync -a media/uploads/ /mnt/nas/esta/backups-full/$(date +%Y%m%d)/
```

```bash
# backup.sh — 分级备份脚本
#!/bin/bash
BACKUP_BASE="backups"

# 第1级：数据库（每次都做，秒级）
DB_DIR="$BACKUP_BASE/$(date +%Y%m%d-%H%M)-db"
mkdir -p "$DB_DIR"
cp data/db.sqlite3 "$DB_DIR/"
cp data/db.sqlite3-wal "$DB_DIR/" 2>/dev/null || true
cp data/db.sqlite3-shm "$DB_DIR/" 2>/dev/null || true

# 第2级：媒体文件增量（rsync，只传差异）
rsync -a --delete media/uploads/ "$BACKUP_BASE/latest/uploads/"

# 第3级：每周完整快照（周日凌晨执行）
if [ "$(date +%u)" = "7" ]; then
    SNAPSHOT_DIR="$BACKUP_BASE/weekly-$(date +%Y%m%d)"
    mkdir -p "$SNAPSHOT_DIR"
    cp data/db.sqlite3 "$SNAPSHOT_DIR/"
    rsync -a media/uploads/ "$SNAPSHOT_DIR/uploads/"
    echo "Weekly snapshot: $SNAPSHOT_DIR"
fi

# 清理：数据库备份保留30天，周快照保留8周
find "$BACKUP_BASE" -name "*-db" -mtime +30 -exec rm -rf {} \;
find "$BACKUP_BASE" -name "weekly-*" -mtime +56 -exec rm -rf {} \;

echo "Backup done: $DB_DIR"
```

恢复：
```bash
# 数据库恢复
cp backups/20260101-1200-db/db.sqlite3 data/
rm data/db.sqlite3-wal data/db.sqlite3-shm 2>/dev/null

# 媒体文件恢复（从最新增量）
rsync -a backups/latest/uploads/ media/uploads/
# 或者从周快照恢复
rsync -a backups/weekly-20260101/uploads/ media/uploads/

# 重启服务
```

### 9.2 PostgreSQL 备份（NAS 部署）

```bash
# pg_dump 生成 SQL 文本，可跨版本恢复
docker compose exec db pg_dump -U postgres esta > backups/$(date +%Y%m%d).sql
tar -czf backups/$(date +%Y%m%d)-uploads.tar.gz media/uploads/
```

恢复：
```bash
docker compose exec -T db psql -U postgres esta < backups/20260101.sql
tar -xzf backups/20260101-uploads.tar.gz
```

### 9.3 NAS 定时备份（添加到 NAS 任务计划）

```bash
0 3 * * * cd /volume1/docker/esta-website && bash scripts/backup.sh
```

## 10. 与当前 Node.js 版的对比

| 方面 | Node.js 当前 | Django 新版 |
|------|-------------|------------|
| 文件数 | ~5 个源文件 | ~20 个文件 (按 app 分离) |
| 管理后台 | 手写 300 行 JS | Django Admin 0 行 |
| 认证 | 手写 session | Django 内置 |
| 权限 | if/else 判断 | 装饰器 + 权限组 |
| 数据库变更 | 手动 ALTER | `makemigrations` → `migrate` |
| 富文本 | Quill JS (CDN) | CKEditor5 (pip install) |
| 文件存储 | 固定路径 | Storage API (可插拔) |
| 启动方式 | `node server.js` | `python manage.py runserver` |
| 生产部署 | 无 | Docker + Gunicorn |
| 测试 | 0 | pytest + Django TestCase |
| 换届交接 | 读代码理解 | 读文档 + django-admin 可视化 |

## 11. 项目目录结构

```
esta-website/
├── manage.py                  # Django 管理入口
├── requirements.txt           # Python 依赖
├── Dockerfile                 # 生产镜像
├── docker-compose.yml         # 本地开发
├── docker-compose.nas.yml     # NAS 部署
├── .env.example               # 环境变量模板
├── .gitignore
│
├── config/                    # Django 项目配置
│   ├── __init__.py
│   ├── settings.py            # 主配置 (读环境变量)
│   ├── urls.py                # 根路由
│   ├── wsgi.py
│   └── asgi.py
│
├── apps/                      # 功能模块
│   ├── core/                  # 主页、静态页
│   │   ├── views.py
│   │   ├── templates/core/
│   │   └── urls.py
│   ├── accounts/              # 用户认证
│   │   ├── models.py          # User 扩展
│   │   ├── views.py           # 登录/登出/改密码
│   │   ├── admin.py
│   │   └── urls.py
│   ├── announcements/         # 公告
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── admin.py
│   │   └── urls.py
│   ├── members/               # 成员管理
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── admin.py
│   │   └── urls.py
│   ├── awards/                # 奖项荣誉
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── admin.py
│   │   └── urls.py
│   └── files/                 # 文件管理
│       ├── models.py
│       ├── views.py
│       ├── admin.py
│       ├── urls.py
│       └── validators.py      # 文件类型白名单
│
├── templates/                 # 全局模板
│   ├── base.html              # 基础布局
│   ├── includes/              # 导航栏、页脚
│   └── dashboard/             # 管理面板模板
│
├── static/                    # 静态资源
│   ├── css/
│   ├── js/                    # 少量 Alpine.js 交互
│   └── img/
│
├── media/                     # 开发环境上传文件 (git忽略)
│   └── uploads/
│
├── backups/                   # 备份文件 (git忽略)
│
├── docs/                          # 项目文档（7份）
│   ├── architecture-python.md     # 架构文档（本文档）
│   ├── development-python.md      # 开发文档
│   ├── quickstart-python.md       # 零基础5分钟启动
│   ├── operations-manual.md       # 运维手册（日常操作+故障排查）
│   ├── backup-restore.md          # 备份恢复指南
│   ├── file-security.md           # 文件安全说明
│   ├── bulk-data-guide.md         # 批量数据导入指南
│   ├── migration-guide.md         # Django Migration 完全指南
│   ├── stability-and-operations.md  # 稳定性与运维分析
│   └── design-flaws-review.md     # 设计自审报告
```
