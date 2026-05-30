# 电子科学与技术协会网站 — 开发文档（Python / Django 版）

## 写给接手的你

这份文档假设你学过 Python 基础，但不一定用过 Django。按照步骤操作即可把项目跑起来。

## 1. 环境准备

### 1.1 需要的软件

| 软件 | 最低版本 | 检查命令 | 说明 |
|------|---------|---------|------|
| Python | 3.12 | `python --version` | 建议用 [python.org](https://python.org) 下载，安装时勾选"Add to PATH" |
| Git | 2.x | `git --version` | 代码版本管理 |
| Docker (可选) | 24+ | `docker --version` | 生产部署用，本地开发可不装 |

### 1.2 克隆项目

```bash
git clone <仓库地址> esta-website
cd esta-website
```

### 1.3 创建虚拟环境

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux / NAS
python3 -m venv .venv
source .venv/bin/activate
```

> **重要**：每次打开终端工作前，先激活虚拟环境。终端提示符前面出现 `(.venv)` 就表示激活成功。

### 1.4 安装依赖

```bash
pip install -r requirements.txt
```

### 1.5 配置环境变量

```bash
# 复制模板文件
cp .env.example .env

# 用记事本打开 .env，修改以下内容：
#   SECRET_KEY=       # 运行 python -c "import secrets; print(secrets.token_urlsafe(50))" 生成
#   ADMIN_PASSWORD=   # 管理员初始密码
```

### 1.6 初始化数据库

```bash
python manage.py migrate          # 创建所有表
python manage.py createsuperuser  # 创建管理员 (用户名 admin，邮箱可不填)
```

### 1.7 启动开发服务器

```bash
python manage.py runserver
```

浏览器打开 `http://127.0.0.1:8000` 即可看到网站。

## 2. 项目结构速览

```
esta-website/
├── manage.py              ← Django 的命令入口，不动它
├── config/settings.py     ← 项目配置 (数据库、文件路径、密钥等)
├── apps/
│   ├── core/              ← 首页、关于页 (最简单，从这里开始看)
│   ├── accounts/          ← 登录、用户管理
│   ├── announcements/     ← 公告的增删改查
│   ├── members/           ← 成员信息管理
│   ├── awards/            ← 奖项荣誉管理
│   └── files/             ← 文件上传下载
├── templates/             ← HTML 模板
│   ├── base.html          ← 所有页面的骨架 (导航栏+页脚)
│   ├── core/              ← 首页模板
│   ├── announcements/     ← 公告相关模板
│   ├── members/           ← 成员相关模板
│   ├── awards/            ← 奖项相关模板
│   ├── files/             ← 文件管理模板
│   ├── accounts/          ← 登录页模板
│   └── dashboard/         ← 管理面板模板
├── static/                ← CSS、JS、图片等静态文件
├── media/uploads/         ← 上传的文件存放处 (自动创建)
└── docs/                  ← 项目文档
```

**新手修改指南**：
- 改文字内容 → 找 `templates/` 下的 HTML 文件
- 改样式 → 找 `static/css/`
- 加新功能 → 找对应 `apps/xxx/views.py` (逻辑) 和 `templates/xxx/` (页面)
- 改数据库结构 → 找对应 `apps/xxx/models.py`
- 一次性导入大量初始资料 → 看 `docs/bulk-data-guide.md`（不要通过网页上传）
- 备份与恢复 → 看 `docs/backup-restore.md`

### 请求流向图

当你访问一个页面时，Django 的处理流程如下：

```
浏览器输入 /members/
        │
        ▼
config/urls.py  ──── 匹配到 members/urls.py
        │
        ▼
members/views.py ──── member_list(request) 函数
        │
        ├── members/models.py   Member.objects.all()  查数据库
        │
        └── templates/members/list.html   渲染 HTML
                │
                ▼
          浏览器显示页面
```

**6 个 App 一句话职责**：

| App | 一句话 | 改什么找这里 |
|-----|--------|------------|
| core | 首页 + 关于页 | 改首页布局 |
| accounts | 登录/登出/改密码/创建账号 | 改登录逻辑 |
| announcements | 公告增删改查 + 富文本 | 改公告字段 |
| members | 成员名片管理 | 改成员字段 |
| awards | 奖项荣誉展示 | 改奖项字段 |
| files | 文件上传下载删除 | 改文件校验规则 |

## 3. 开发工作流

### 3.1 日常开发循环

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 激活虚拟环境
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS/Linux

# 3. 如果有新依赖
pip install -r requirements.txt

# 4. 如果有数据库变更
python manage.py migrate

# 5. 启动开发服务器 (自动重载)
python manage.py runserver

# 6. 修改代码 → 浏览器刷新看效果 → 重复
```

### 3.2 搜索功能

```python
# core/views_public.py — 全局搜索
from django.db.models import Q

def search(request):
    q = request.GET.get('q', '').strip()
    if not q:
        return render(request, 'public/search.html', {'results': None})

    # 搜索文件（需登录）
    files = []
    if request.user.is_authenticated:
        files = UploadedFile.objects.filter(
            Q(original_name__icontains=q) | Q(description__icontains=q)
        )[:50]

    # 搜索公告（所有人）
    announcements = Announcement.objects.filter(
        Q(title__icontains=q) | Q(content__icontains=q),
        is_published=True
    )[:20]

    return render(request, 'public/search.html', {
        'query': q,
        'files': files,
        'announcements': announcements,
    })
```

> 初期用 Django `__icontains`（LIKE 查询）即可。10,000 条记录下响应时间 < 50ms。如果未来文件数 > 50,000 且搜索变慢，升级到 SQLite FTS5 全文索引（无需额外服务，SQLite 内置）。

### 3.3 富文本编辑器配置 (CKEditor)

```bash
pip install django-ckeditor-5
```

在 `config/settings.py` 中添加：

```python
INSTALLED_APPS = [
    ...
    'ckeditor',
    'ckeditor_uploader',
]

# CKEditor 配置
CKEDITOR_UPLOAD_PATH = 'uploads/ckeditor/'
CKEDITOR_CONFIGS = {
    'default': {
        'toolbar': 'full',
        'height': 400,
        'width': '100%',
    },
}
```

在 `config/urls.py` 中添加：

```python
urlpatterns = [
    ...
    path('ckeditor/', include('ckeditor_uploader.urls')),
]
```

### 3.4 修改数据库模型

```bash
# 1. 修改 apps/xxx/models.py
# 2. 生成迁移文件
python manage.py makemigrations

# 3. 应用迁移
python manage.py migrate

# 4. 如果搞砸了，回退一步
python manage.py migrate <app_name> <上一个迁移编号>
```

### 3.5 运行测试

```bash
# 全部测试
python manage.py test

# 只测某个 app
python manage.py test apps.members

# 只测某个测试类
python manage.py test apps.members.tests.MemberModelTest
```

## 4. Django 核心概念速成

### 4.1 MVT 模式

```
URL请求 → urls.py (路由) → views.py (视图逻辑) → template (HTML页面)
                                ↓
                           models.py (数据库操作)
```

**一句话**：`urls.py` 决定"哪个网址走哪个函数"，`views.py` 里的函数处理请求并返回页面，`models.py` 定义了数据库表结构。

### 4.2 常用 ORM 操作

```python
# 查全部
Member.objects.all()

# 条件查
Member.objects.filter(position='会长')

# 查单条 (没有会报错)
Member.objects.get(id=1)

# 查单条 (没有返回 None)
Member.objects.filter(id=1).first()

# 排序
Member.objects.all().order_by('order', '-created_at')

# 创建
Member.objects.create(name='王五', position='新成员')

# 更新
member = Member.objects.get(id=1)
member.position = '前会长'
member.save()

# 删除
Member.objects.filter(id=1).delete()
```

### 4.3 权限控制

```python
# views.py 里判断权限

from django.contrib.auth.decorators import login_required
from django.contrib.admin.views.decorators import staff_member_required

# 需要登录
@login_required
def upload_file(request):
    ...

# 仅管理员
@staff_member_required
def batch_delete_files(request):
    ...

# 自定义判断
from django.contrib.auth.decorators import user_passes_test

def is_admin(user):
    return user.is_authenticated and user.role == 'admin'

@user_passes_test(is_admin)
def create_account(request):
    ...
```

在模板里判断：
```django
{% if user.is_authenticated %}
  <a href="/dashboard/">管理面板</a>
{% endif %}

{% if user.role == 'admin' %}
  <a href="/dashboard/accounts/">账号管理</a>
{% endif %}
```

## 5. 常用操作手册

### 5.1 发一篇新公告

1. 登录 → 进入管理面板 → 公告管理 → 新建公告
2. 填写标题、选择分类 (新闻/课程/考核)
3. 用富文本编辑器写内容 (可插入图片)
4. 默认保存为草稿，确认无误后点"发布"

### 5.2 上传资料（日常少量文件）

1. 登录 → 文件管理 → 上传文件
2. 选择分类 (学习资料/项目代码/教学视频/电路设计/固件/工具软件/系统镜像)
3. 拖拽或选择文件（视频/工具/镜像类最大 2GB，其他 100MB）
4. 可选填写描述；上传可执行文件时必须填写 SHA256 校验值

> **批量导入大量初始资料**（几十GB）请使用管理命令，见 `docs/bulk-data-guide.md`。不要通过网页逐个上传。

### 5.3 添加/编辑协会成员

1. 登录 → 成员管理 → 添加成员
2. 填写姓名、职位、简介、技能、联系方式
3. "联系方式公开"开关：打开则访客可见，关闭则需登录才能看

### 5.4 添加获奖记录

1. 登录 → 奖项管理 → 添加奖项
2. 填写竞赛名称、奖项、获奖日期
3. 选择获奖成员 (可多选)

### 5.5 批量删除文件 (仅管理员)

1. 管理员登录 → 文件管理 → 批量删除
2. 勾选需要删除的文件
3. 确认删除 (不可恢复)

### 5.6 更改密码

1. 登录后 → 右上角用户名 → 修改密码
2. 输入旧密码 + 新密码

### 5.7 备份数据

```bash
# 使用项目自带的备份脚本
bash scripts/backup.sh
```

该脚本做了两件事：
1. 直接复制 SQLite 数据库文件（`db.sqlite3` + `db.sqlite3-wal` + `db.sqlite3-shm`）→ 秒级完成
2. 用 `rsync` 增量同步媒体文件 → 只传变化，几十GB也不慢

详细说明见 `docs/backup-restore.md`。

### 5.8 恢复数据

```bash
# 恢复数据库
cp backups/20260101-1200-db/db.sqlite3 data/
rm data/db.sqlite3-wal data/db.sqlite3-shm 2>/dev/null

# 恢复媒体文件
rsync -a backups/latest/uploads/ media/uploads/

# 重启服务
```

详细说明见 `docs/backup-restore.md`。

## 6. 部署指南

### 6.1 新手零依赖启动（推荐首选）

不需要安装 Docker，只要 Python 3.12+ 即可：

```bash
# 1. 克隆项目
git clone <仓库地址> esta-website
cd esta-website

# 2. 虚拟环境 + 依赖
python -m venv .venv
source .venv/bin/activate     # Linux/macOS
# .venv\Scripts\activate      # Windows
pip install -r requirements.txt

# 3. 配置
cp .env.example .env
# 编辑 .env：用 python -c "import secrets; print(secrets.token_urlsafe(50))" 生成 SECRET_KEY

# 4. 初始化
python manage.py migrate
python manage.py createsuperuser

# 5. 启动
python manage.py runserver
```

浏览器打开 `http://127.0.0.1:8000`。

### 6.2 Docker 部署（高级选项，适合 NAS/生产环境）

```bash
# 1. 确保 .env 文件配置正确
cp .env.example .env
nano .env   # 修改 SECRET_KEY 和 ADMIN_PASSWORD

# 2. 构建并启动
docker compose up -d --build

# 3. 收集静态文件 + 创建管理员
docker compose exec app python manage.py collectstatic --noinput
docker compose exec app python manage.py createsuperuser

# 4. 查看日志
docker compose logs -f

# 5. 停止
docker compose down

# 6. 更新代码后重新部署
git pull
docker compose up -d --build
docker compose exec app python manage.py collectstatic --noinput
```

### 6.3 NAS 部署

```bash
# NAS 上通常有 Docker 套件，安装后 SSH 登录 NAS

# 1. 把代码传到 NAS
scp -r ./esta-website admin@nas-ip:/volume1/docker/esta-website/

# 2. 使用 NAS 专用的 compose 文件
cd /volume1/docker/esta-website
docker compose -f docker-compose.nas.yml up -d

# 3. 配置 Caddy 自动获取 SSL 证书 (需要已有域名)
# 编辑 Caddyfile 里的域名，重启 caddy 服务

# 4. NAS 定时备份 (加到 NAS 任务计划)
0 3 * * * cd /volume1/docker/esta-website && ./scripts/backup.sh
```

### 6.4 申请域名后的配置

1. 在 Caddyfile 里把 `:80` 改成你的域名
2. Caddy 会自动申请 Let's Encrypt HTTPS 证书
3. 登录 Django Admin，在 `sites` 里修改域名

## 7. Django Admin 使用

Django Admin 是一个自动生成的管理界面，在 `/admin/` 路径下。

**优点**：
- 不用写一行代码就有增删改查界面
- 支持搜索、过滤、排序
- 权限和操作日志自动记录

**管理员可执行的操作**：
- 查看/编辑/删除所有数据
- 查看最近操作记录
- 直接上传文件、管理用户

访问：`http://127.0.0.1:8000/admin/`，用超级用户登录。

## 8. 配置文件说明

项目根目录有 `.env.example` 模板文件，复制为 `.env` 后按需修改。

```ini
# ====== 必填 ======
# Django 密钥 — 绝对不能泄露/提交到git
# 生成方式: python -c "import secrets; print(secrets.token_urlsafe(50))"
SECRET_KEY=随机字符串50位

# 调试模式 — 开发时 True，部署时务必设为 False
DEBUG=True

# 允许访问的域名 (逗号分隔)
ALLOWED_HOSTS=127.0.0.1,localhost

# ====== 数据库 ======
# SQLite (默认，开发用) — 什么都不用改
DATABASE_URL=sqlite:///data/db.sqlite3

# PostgreSQL (NAS 生产环境):
# DATABASE_URL=postgres://esta:password@db:5432/esta

# ====== 管理员 ======
# 初始管理员密码 (仅首次 createsuperuser 时使用)
ADMIN_PASSWORD=changeme

# ====== 文件上传 ======
# 上传文件存储目录 (相对于项目根目录)
MEDIA_ROOT=media/uploads

# 最大上传大小: 视频/工具/镜像类 2GB，其他 100MB
# 单位: 字节
FILE_UPLOAD_MAX_SIZE=2147483648

# 分片上传大小 (用于大文件断点续传)
CHUNK_UPLOAD_SIZE=5242880   # 5MB per chunk

# ====== 会话 ======
# 会话过期时间 (秒)，默认 2 小时
SESSION_COOKIE_AGE=7200

# ====== 部署 ======
# Docker 数据库密码 (仅 NAS 部署)
DB_PASSWORD=changeme
# 域名 (Caddy 自动 HTTPS)
DOMAIN=esta.example.com
```

## 9. 代码规范

### 9.1 Python 规范

- 用 `black` 自动格式化：`black apps/`
- 用 `isort` 整理导入顺序：`isort apps/`
- 函数/变量用小写下划线：`def upload_file(request):`
- 类用大驼峰：`class UploadedFile(models.Model):`
- 常量用全大写：`MAX_FILE_SIZE = 104857600`

### 9.2 模板规范

- 所有页面继承 `base.html`
- block 命名用英文：`{% block content %}`
- 用户可见文字用中文
- 链接用 `{% url 'name' %}` 而非硬编码路径

### 9.3 Git 提交规范

```
feat: 添加奖项展示页面
fix: 修复文件下载计数不更新问题
docs: 更新部署文档
chore: 升级 Django 到 5.0.x
```

## 10. 常见问题

### Q: 启动报 "No module named 'django'"
虚拟环境没激活，执行 `venv\Scripts\activate` 后再试。

### Q: 数据库报 "table already exists"
先 `python manage.py migrate --fake <app_name>` 跳过已存在的表。

### Q: 上传文件失败
检查 `media/uploads/` 目录是否有写入权限；检查文件大小是否超过限制（视频/工具 2GB，其他 100MB）。

### Q: 静态文件不加载 (部署时)
执行 `python manage.py collectstatic --noinput`。

### Q: 忘记管理员密码
```bash
# 适用于所有用户（不仅是 admin）
python manage.py changepassword admin
python manage.py changepassword <任意用户名>

# 如果连服务器都登不进去（唯一管理员失联）：
# 1. 找到协会办公室密封的紧急密码信封
# 2. 或者通过 NAS 管理页面 / 服务器供应商面板重置
```
### Q: 内网部署（服务器无法访问互联网）
学校内网环境部署注意事项：
1. PyPI 不通 → 准备 `requirements.txt` 对应的 wheel 包，用 `pip install --no-index --find-links=./wheels/`
2. JS 库 CDN 不通 → `alpine.js`、`htmx.js` 放 `static/js/` 本地引用；CKEditor 走 `django-ckeditor-5` 本地静态文件
3. 无法申请 HTTPS 证书 → 仅使用 HTTP（内网可接受），Caddy 配置改为 `http://`
4. 完整离线部署步骤见 `docs/quickstart-python.md` 末尾

### Q: 如何重置整个数据库
```bash
# 删除数据库文件
rm data/db.sqlite3        # Linux/macOS
del data\db.sqlite3       # Windows

# 重新创建
python manage.py migrate
python manage.py createsuperuser
```

## 11. 换届交接清单

每年换届时，离任负责人需要：

- [ ] 将新负责人加入 git 仓库 collaborator
- [ ] 确保 `.env` 文件备份在安全处 (不在 git 里)
- [ ] 执行一次完整备份，将备份文件交给新负责人
- [ ] 确认新负责人可以 `git clone` → `docker compose up` 成功启动
- [ ] 确认新负责人知道管理员密码
- [ ] 确认域名续费正常 (如有)
- [ ] 确认 NAS 存储空间充足 (如有)
- [ ] 更新 `docs/` 下任何过期的信息

交接完成后，新负责人应该：
- [ ] 修改管理员密码
- [ ] 修改 `.env` 里的 `SECRET_KEY` (重新生成)
- [ ] 完整走一遍备份+恢复流程，确认会操作
- [ ] **将服务器密码/SSH key 纸质存档，密封在协会办公室**（防止唯一管理员失联导致网站无法维护）
- [ ] 确认自己有 NAS 管理页面 / 服务器供应商的独立登录入口（不依赖唯一 SSH）

## 12. 依赖清单 (requirements.txt)

```
# 核心
Django>=5.0,<5.1
gunicorn>=22.0
whitenoise>=6.7

# 数据库
psycopg2-binary>=2.9       # PostgreSQL (NAS 部署时安装)

# 富文本
django-ckeditor-5>=0.2

# 文件处理
Pillow>=11.0               # 头像/奖项图片
python-magic>=0.4.27       # 魔术字校验
django-chunked-upload>=3.0 # 分片上传

# 安全
django-axes>=7.0           # 登录限流

# 环境变量
python-dotenv>=1.0
dj-database-url>=2.2       # 数据库URL解析

# 开发工具
black>=24.0                # 代码格式化
isort>=5.13                # 导入排序
pytest-django>=4.8         # 测试框架
```

## 13. 从旧 Node.js 版迁移数据

如果当前 Node.js 版已有实际数据，迁移步骤：

```bash
# 1. 从旧数据库导出数据
# 旧项目在 data/esta.db，用 SQLite 客户端查看表结构
sqlite3 data/esta.db ".schema" > old_schema.sql

# 2. 编写迁移脚本
python manage.py migrate_data    # (自定义管理命令，需按实际情况编写)

# 3. 验证数据完整性
python manage.py test
```

核心映射关系：
- 旧 `users` → 新 `accounts_user`
- 旧 `announcements` → 新 `announcements_announcement`
- 旧 `members` → 新 `members_member`
- 旧 `files` → 新 `files_uploadedfile` (注意路径要改相对路径)

> 如果没有实际数据，直接用 Django 重新录入即可。

## 14. 项目地址与联系方式

- 代码仓库：`<待填>`
- 服务器地址：`<待填>`
- 管理员账号：`admin`
- 初始密码：见 `.env` 文件 `ADMIN_PASSWORD`

---

> 这份文档会随着项目一起更新。如果你发现任何过时或错误的内容，请提交 PR 更新它。
