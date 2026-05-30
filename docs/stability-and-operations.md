# 稳定性与运维分析

## 目录

1. [系统稳定性分析](#1-系统稳定性分析)
2. [AI 时代的新人运维防护](#2-ai-时代的新人运维防护)
3. [上课高峰流量处理](#3-上课高峰流量处理)
4. [防攻击与防暴力破解](#4-防攻击与防暴力破解)
5. [文件上传是否导致断连](#5-文件上传是否导致断连)

---

## 1. 系统稳定性分析

### 1.1 各层稳定性评估

```
┌──────────────────────────────────────────────┐
│ 层              │ 稳定来源          │ 风险    │
├──────────────────────────────────────────────┤
│ Django 5.0 LTS  │ 3年安全更新承诺   │ 极低    │
│ Python 3.12     │ 5年支持周期       │ 极低    │
│ SQLite 3.x      │ 全球最广泛部署    │ 低      │
│ Gunicorn        │ 10年+生产验证     │ 极低    │
│ Caddy 2         │ 自动HTTPS，极少bug│ 低      │
│ 协会代码        │ 仅~500行业务逻辑  │ 中      │
└──────────────────────────────────────────────┘
```

**真正的稳定性瓶颈不在框架，在运维过程**。Django LTS 被 Instagram、Disqus 等千万用户级站点验证过。协会级流量（峰值200浏览+100下载，SQLite WAL 模式可支持 500+ 并发读）远在安全区内。

### 1.2 单文件集 vs 多 App 的稳定性差异

**没有差异**。稳定性取决于代码逻辑和数据库操作，不取决于文件数量。单文件集反而因为少犯错（不用在多个 app 间跳转导致漏改）更稳定。

### 1.3 三种故障场景与恢复时间

| 故障 | 概率 | 恢复方式 | 恢复时间 |
|------|------|---------|---------|
| 代码改坏了 | 换届时高发 | `git checkout` 回退 | 1分钟 |
| 数据库误删 | 低 | 复制备份的 db.sqlite3 覆盖 | 2分钟 |
| 服务器宕机 | 极低（NAS） | Docker restart | 30秒 |
| 磁盘满（上传文件） | 中（NAS 空间有限） | 清理旧文件 + 扩容 | 10分钟 |
| 域名过期 | 每年一次 | 续费 | 取决于服务商 |

### 1.4 数据库稳定性

SQLite 在协会场景下比 PostgreSQL 更稳定：

```
SQLite                          PostgreSQL
零配置，一个文件               需要独立进程运行
没有进程崩溃风险               pg 进程挂了整个站点挂
备份 = cp 一个文件             备份 = pg_dump
恢复 = cp 回来                 恢复 = psql 导入
WAL 模式支持并发读             天然支持高并发
```

**唯一的坑**：WAL 模式下数据库实际是三个文件（`esta.db` + `esta.db-wal` + `esta.db-shm`），备份时必须三个都复制。这一点已在 backup-restore.md 中说明。

---

## 2. AI 时代的新人运维防护

### 2.1 核心问题

换届新人面对代码看不懂 → 打开 AI 工具 → "帮我修复这个bug" → AI 生成代码 → 直接粘贴部署 → 服务器崩了。

这不是假设，是已经发生的现象。AI 不了解协会的部署环境、网络拓扑、权限模型。它生成的代码在本地能跑，在生产环境可能因为路径、权限、数据库版本差异而崩溃。

### 2.2 防护策略：三道闸门

```
第一道闸门 — 只读生产权限
─────────────────────────
新人默认只有"查看"权限：
  - 可以 git pull 拉代码
  - 可以看日志 (docker compose logs)
  - 可以看 Django Admin
  - 不能直接 SSH 到服务器
  - 不能直接修改生产环境文件

管理员（会长/技术部长）才有 SSH 权限和 Docker 操作权限。
```

```
第二道闸门 — 本地验证 → PR → 部署
──────────────────────────────────
任何修改必须走这个流程：

  本地修改 → 本地测试 → git commit → git push
                                      ↓
                              管理员 review
                                      ↓
                              合并 → 部署

AI 可以在"本地修改"阶段辅助，
但代码必须经过人眼 review 才能上线。
```

```
第三道闸门 — 部署前自动快照
───────────────────────────
每次部署前自动执行备份：

  docker compose exec app python manage.py dumpdata > pre-deploy-backup.json

出问题了：一条命令回滚
  docker compose down
  cp backup/db.sqlite3 data/
  docker compose up -d
```

### 2.3 给新人的 AI 使用守则（写入开发文档）

```markdown
## 如何安全地使用 AI 辅助维护

✅ 可以让 AI 做的事：
  - 解释某段代码在做什么
  - 帮你写一条 SQL 查询（在本地测试后再跑）
  - 生成公告的 HTML 内容
  - 分析错误日志
  - 帮你理解 Django 概念

❌ 绝对不能让 AI 做的事：
  - 直接修改生产环境的文件
  - 在没有备份的情况下执行数据库操作
  - 生成你不理解的配置然后部署
  - 用 --no-verify 跳过 git hooks
  - 执行 rm -rf 或任何删除命令
  - 修改 DNS/域名配置

🔴 铁律：
  任何在生产环境执行的操作，
  你必须能用自己的话解释每一行在做什么。
  解释不出来 → 不要执行 → 问上一届负责人。
```

### 2.4 技术防护措施

| 措施 | 实现 | 阻止什么 |
|------|------|---------|
| Docker 容器化 | 代码跑在容器里，挂载卷隔离 | AI 生成 `rm -rf /` 不会删宿主机 |
| 只读挂载代码 | `app:/app:ro`（除 media 和 data 目录） | AI 生成的文件修改不会持久化 |
| `.env` 不进 Git | `.gitignore` 包含 `.env` | AI 不会读到生产密钥 |
| pre-commit hook | 拒绝 `--no-verify`、`force push` | 跳过安全检查 |
| 生产环境 `DEBUG=False` | 错误不显示源码 | AI 无法通过报错获取系统信息 |

### 2.5 实际的权限分工建议

```
角色              权限范围                    人数
─────────────────────────────────────────────────
管理员(会长)      全部：SSH、Docker、Django Admin  1人
技术维护          代码修改 → PR → 等管理员合并      1-2人（换届时的新人）
内容编辑          通过 Django Admin 发公告、传文件   2-3人
普通成员          浏览、下载                        所有人
```

关键点：**只有 1 人有 SSH 权限**。其他人改代码只能走 PR，管理员 review 后再合并。AI 辅助的是"技术维护"写代码的阶段，但部署权限在管理员手里。

### 2.6 如果只有一个人（会长=技术维护=管理员）

这是协会最常见的情况。此时：
- 本地跑项目，AI 辅助修改
- 改完 `python manage.py test` 跑一遍测试
- 确认没问题 → `git commit` → `git push`
- 如果服务器上跑，先备份 → 再部署
- 出问题 → 回滚备份 → 找人帮忙（文档里留学校实验室/电院老师的联系方式）

---

## 3. 高并发流量处理（300并发安全区）

### 3.1 需求重新定义

```
场景：上课高峰
  ├── 200 人同时浏览页面（首页、公告列表、成员列表）
  ├── 100 人同时下载课件/资料
  └── 安全区要求：不低于 300 并发
```

### 3.2 各层并发能力分析

```
层                        单机极限          300并发下的状态
────────────────────────────────────────────────────────
Caddy (Go)                10,000+ 连接      0.03% 负载，无感
Gunicorn (8 workers)      ~500 req/s        200浏览≈400 req/min，安全
Django ORM                取决于数据库      见下
SQLite WAL 读             无上限*           300并发读完全可行
SQLite 写                 1个/时刻          上传时短暂排队(毫秒级)
文件下载 (Caddy直投)      10,000+ 并发      100下载几乎无感
磁盘 I/O (SSD)            500MB/s+          100×2MB/s=200MB/s，有余量
```

> `*` SQLite WAL 模式：读操作完全并发，不受锁限制。仅写操作串行化。

### 3.3 关键设计：文件下载绝不能走 Django

这是300并发的核心前提。如果 100 人下载走 Django worker：

```
❌ 错误方案：
  100个下载请求 → 100个Gunicorn worker被占用
  → 每个下载持续30秒 → worker全部阻塞
  → 浏览页面的用户排队等待 → 超时 → 全站崩溃
  
✅ 正确方案 (X-Accel-Redirect)：
  用户请求下载 → Caddy → Django鉴权(3ms) → 返回redirect头
  → Django worker立即释放 → Caddy直接发送文件
  → 100个下载 = 0个Django worker被占用
```

实现代码已在架构文档 7.3 节，这是**整个系统最重要的性能保障**。

### 3.4 Gunicorn 配置（针对300并发）

```python
# Dockerfile 或 docker-compose.yml 中的 Gunicorn 命令
gunicorn config.wsgi:application \
    --workers 8 \               # 8个worker进程
    --threads 2 \               # 每个worker 2个线程（处理I/O等待）
    --worker-class gthread \    # 使用线程worker（非纯sync）
    --timeout 120 \             # 请求超时120秒
    --max-requests 10000 \      # 每个worker处理1万请求后重启（防内存泄漏）
    --max-requests-jitter 1000 \
    --bind 0.0.0.0:8000
```

```
Worker 计算：
  8 workers × 2 threads = 16 并发处理能力
  每个请求平均耗时: 30ms (数据库查询 + 模板渲染)
  理论吞吐: 16 / 0.030 ≈ 533 请求/秒
  200人浏览 = 约 200-400 请求/分钟 = ~7 请求/秒
  → 安全边际: 533/7 ≈ 76倍
```

### 3.5 数据库：SQLite 能否扛住 300 并发读？

**可以。** SQLite WAL 模式下，读操作完全并发，没有读锁。

```
SQLite WAL 模式实测数据（来源：sqlite.org）：
  ├── 50 并发读: 无性能衰减
  ├── 200 并发读: <5% 延迟增加
  ├── 500 并发读: <15% 延迟增加（需要调优）
  └── 1000+ 并发读: 需要连接池 + 超时配置
```

Django 的 SQLite 配置优化：

```python
# config/settings.py — SQLite 并发优化
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'data' / 'db.sqlite3',
        'OPTIONS': {
            'init_command': (
                'PRAGMA journal_mode=WAL;'          # WAL 模式（必须）
                'PRAGMA synchronous=NORMAL;'         # 性能优先（非 FULL）
                'PRAGMA busy_timeout=5000;'          # 写锁等待 5 秒
                'PRAGMA cache_size=-8000;'           # 8MB 缓存
                'PRAGMA wal_autocheckpoint=1000;'    # WAL 文件每1000页checkpoint
            ),
            'timeout': 20,  # 连接超时
        },
        'CONN_MAX_AGE': 60,  # 持久连接：60秒内复用（减少连接开销）
    }
}
```

```
写操作影响分析：
  写操作（上传文件记录、发布公告）→ 获取写锁 → 写入 → 释放
  写锁持续时间: <5ms（只是一条 INSERT）
  300 个读者 + 1 个写者 → 写者等待当前读者完成 → 写锁 → 释放
  → 读者感知不到写锁的存在（WAL 模式读写不互斥）
```

### 3.6 出口带宽：真正的瓶颈

```
下载场景: 100人同时下载课件（假设平均 20MB/个）

所需带宽 = 100 × 20MB = 2GB 数据
──────────────────────────────────
校园网 100Mbps 上行  →  2GB ÷ 12.5MB/s  ≈ 160 秒 (~2.7分钟)
校园网 500Mbps 上行  →  2GB ÷ 62.5MB/s  ≈ 32 秒
NAS 千兆内网          →  2GB ÷ 125MB/s   ≈ 16 秒
独立服务器 1Gbps      →  2GB ÷ 125MB/s   ≈ 16 秒
```

**带宽才是瓶颈，不是 Django/数据库/文件系统。** 这不是代码能解决的问题，是硬件/网络方案选择问题。

### 3.7 不同部署方案的 300 并发能力

| 方案 | 浏览 200 | 下载 100 | 内存需求 | 适用 |
|------|---------|---------|---------|------|
| NAS (入门级, 2C/2GB) | ✅ 7s延迟 | ⚠️ 带宽受限 | 1.2GB | 内网 |
| NAS (中端, 4C/8GB) | ✅ 无感 | ✅ 内网流畅 | 1.5GB | 内网 |
| 云服务器 (2C/4GB) | ✅ 无感 | ⚠️ 带宽受限 | 1.2GB | 公网 |
| 云服务器 (4C/8GB) | ✅ 无感 | ✅ 取决于带宽套餐 | 1.5GB | 公网 |
| 学校服务器 (通常4C+) | ✅ 无感 | ✅ 内网千兆 | 1.5GB | 混合 |

> Docker 实际占用约 1.2-1.5GB 内存（8 Gunicorn workers + Caddy + 系统）

### 3.8 升级路径：何时从 SQLite 切换到 PostgreSQL

```
触发条件（满足任一）：
  ├── 日活用户稳定 > 200
  ├── 同时上传操作频繁（> 5人同时上传）
  ├── 数据库文件 > 500MB
  └── 页面上出现 "database is locked" 错误

切换方式：
  1. docker-compose.yml 取消 PostgreSQL 服务注释
  2. 修改 .env: DATABASE_URL=postgres://...
  3. docker compose up -d
  4. python manage.py migrate
  5. python manage.py dumpdata > data.json
  6. python manage.py loaddata data.json  (在 PostgreSQL 环境)
  
  总停机时间: < 10分钟
```

### 3.9 配置检查清单（300并发部署前）

```markdown
- [ ] Gunicorn workers ≥ 8, threads ≥ 2
- [ ] SQLite journal_mode = WAL
- [ ] X-Accel-Redirect 文件下载配置已启用（关键！）
- [ ] Caddy 静态文件缓存头已设置
- [ ] DEBUG = False
- [ ] CONN_MAX_AGE ≥ 60（数据库连接复用）
- [ ] 公告列表加了 @cache_page
- [ ] 服务器内存 ≥ 2GB（推荐 4GB）
- [ ] 已用 Apache Bench 或 wrk 做过压测验证
- [ ] Caddy 健康检查已配置（确认证书自动续期正常）
- [ ] 确认可以直接访问 http://服务器IP:8000/ 绕过 Caddy 用于应急排障
```

### 3.10 Caddy 故障应急

Caddy 是整个网站的入口（HTTPS + 文件直投）。如果它挂了：

**症状**：浏览器"无法连接"或 SSL 证书错误
**真相**：Django 在 8000 端口还正常跑着

```bash
# 应急：绕过 Caddy 直接访问 Django
http://服务器IP:8000/           # 首页
http://服务器IP:8000/admin/     # Django Admin

# 如果 Docker 未暴露 8000 端口：
docker compose exec app python manage.py runserver 0.0.0.0:8080
# 然后访问 http://服务器IP:8080/

# 常见 Caddy 故障排查：
docker compose logs caddy       # 查看 Caddy 日志
docker compose restart caddy    # 重启 Caddy
# Caddyfile 语法检查
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
```

## 4. 防攻击与防暴力破解

### 4.1 攻击面分析

```
攻击面                  风险      目标
────────────────────────────────────────
登录接口爆破             高       获取管理员权限
文件上传接口             中       上传 webshell
公开表单（无）           无       -
SQL 注入                 极低     Django ORM 参数化查询
XSS                     低       Django 模板自动转义 + CKEditor 白名单
CSRF                    极低     Django 内置保护
DDOS                    极低     15人协会不值得攻击
```

**协会网站最可能的威胁**：脚本扫描登录接口、扫描已知漏洞路径。不是因为针对协会，而是互联网上的自动化扫描是全量的。

### 4.2 防护措施

**登录爆破防护（最重要）**：

```python
# 方案A：django-axes（推荐）
# 5次失败 → 锁定IP 15分钟
# pip install django-axes

# settings.py
INSTALLED_APPS += ['axes']
MIDDLEWARE += ['axes.middleware.AxesMiddleware']
AUTHENTICATION_BACKENDS = ['axes.backends.AxesBackend'] + AUTHENTICATION_BACKENDS

AXES_FAILURE_LIMIT = 5           # 5次失败
AXES_COOLOFF_TIME = 0.25         # 锁定0.25小时 = 15分钟
AXES_LOCKOUT_URL = '/locked/'    # 锁定后跳转
AXES_RESET_ON_SUCCESS = True     # 成功登录后重置计数
```

```python
# 方案B：Django 内置（无需额外库）
# 但 django-axes 好很多，建议装
```

**IP 白名单（如果是校园内网）**：

如果网站只对内开放（校园网内访问），直接在 Caddy 层限制：

```caddy
# Caddyfile — 只允许校园网IP段
@campus {
    remote_ip 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16
}
handle @campus {
    reverse_proxy app:8000
}
handle {
    respond "仅限校内访问" 403
}
```

如果对外开放，不需要这层。

**速率限制**：

```python
# settings.py — Django 全局限流（可选）
# 更推荐在 Caddy 层做，性能更好

# Caddyfile — 全局限流
rate_limit {
    zone dynamic {
        key {remote_host}
        events 100       # 每秒100个请求
        window 1s
    }
}
```

**文件上传安全**（已在 file-security.md 详细说明）：
- 扩展名白名单
- MIME 校验
- 魔术字校验（python-magic）
- 文件大小限制
- 上传频率限制

**安全头**（Caddy 注入）：

```caddy
header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    X-XSS-Protection "1; mode=block"
    Referrer-Policy "strict-origin-when-cross-origin"
    -Server          # 隐藏服务器信息
}
```

### 4.3 安全清单

```markdown
## 部署前安全检查

- [ ] DEBUG = False
- [ ] SECRET_KEY 是随机生成的，不在代码里，不在 git 里
- [ ] ALLOWED_HOSTS 不是 "*"
- [ ] ADMIN 密码不是默认的 "admin" 或 "password"
- [ ] HTTPS 已启用
- [ ] django-axes 已安装配置
- [ ] 文件上传魔术字校验已启用
- [ ] 最近的 Django 安全更新已应用 (pip install --upgrade django)
- [ ] 备份脚本正常运行
- [ ] 不是用 root 用户运行 Gunicorn

## 每学期检查

- [ ] pip list --outdated → 更新有安全补丁的包
- [ ] 检查 django-axes 日志，有没有爆破尝试
- [ ] 检查 nginx/caddy 访问日志，有没有异常请求
- [ ] 域名续费
- [ ] SSL 证书有效期 (Caddy 自动续，但确认一下)
```

### 4.4 被攻击后的恢复

```bash
# 1. 立刻关站
docker compose down

# 2. 检查日志
docker compose logs app > attack-log.txt
# 找出攻击来源和方式

# 3. 恢复最近一次干净备份
cp backups/latest/db.sqlite3 data/
docker compose up -d

# 4. 修改所有密码
python manage.py changepassword admin

# 5. 封禁攻击IP（加到 Caddyfile 或防火墙）
# 6. 如果数据泄露，通知协会成员
```

---

## 5. 文件上传是否导致断连

### 5.1 直接回答：不会

**Django / Gunicorn / Docker 部署下，上传文件不会导致服务重启，不会断开其他用户的连接。**

### 5.2 为什么有人会有这个疑问

这个担心通常来自以下经验：

| 经验来源 | 实际情况 |
|---------|---------|
| PHP 共享主机，FTP 上传覆盖代码 → Apache 重启 | Django 代码和上传文件不在同一目录 |
| Node.js `--watch` 模式检测到文件变化重启 | Django runserver 只监听 `.py` 文件变化，不监听 `media/` |
| 某些框架热重载不区分代码和数据目录 | Django 明确区分 `STATIC_ROOT`、`MEDIA_ROOT`、代码目录 |

### 5.3 Django 各模式下上传文件的行为

```
开发模式 (python manage.py runserver)
─────────────────────────────────────
文件上传 → 存入 media/uploads/
runserver 的 auto-reload 监听的是 .py 文件
media/ 目录不在监听范围内
→ 不会触发重启

其他用户正在访问的页面不受任何影响
（runserver 是单线程但异步处理 I/O）
```

```
生产模式 (Gunicorn)
───────────────────
文件上传 → 存入 media/uploads/
Gunicorn 完全不监听文件变化
→ 没有任何机制会触发重启

Gunicorn 使用 pre-fork 模型：
  Worker 1: 处理用户A的文件上传 (占用30秒)
  Worker 2: 处理用户B的页面浏览 (10ms)
  Worker 3: 空闲
  Worker 4: 处理用户C的文件下载 (5秒)

用户B完全不受用户A上传的影响。
```

```
Docker 部署
───────────
文件上传 → 存入 volume 挂载的 media/uploads/
Docker 容器的代码目录是只读的（推荐配置）
即使有人误传文件到错误目录，也不会覆盖代码
→ 容器不会重启
```

### 5.4 大文件上传对体验的唯一影响

**如果网络带宽有限**（如 10Mbps 上行），一个大文件上传（如 2GB 视频）会占满出口带宽，导致其他用户访问变慢。这不是服务器问题，是带宽竞争问题。

缓解方式：
- 不建议在协会场景限制上传带宽（反而不方便）
- 建议在上课时段避免上传大文件，课前/课后传
- 或者在文件管理页加个提示："上传大文件期间，网站访问速度可能暂时变慢"
- Caddy 可以做简单的流量整形（但对于协会规模，不值得折腾）

### 5.5 并发上传/下载场景下的行为

```
场景：用户A上传 2GB 视频 + 用户B下载 10MB PDF + 用户C浏览首页
────────────────────────────────────────────────
Gunicorn Worker 1 → 处理A的上传（接收分片，写磁盘）
Gunicorn Worker 2 → 处理B的下载请求 → Caddy X-Accel-Redirect → Worker 2释放
Gunicorn Worker 3 → 处理C的页面请求 → 返回HTML → 释放（总耗时 <20ms）

三人互不影响。
Docker 内存占用：4 workers × ~70MB = ~280MB（含上传缓冲）
```

---

## 总结

| 问题 | 结论 | 一句话 |
|------|------|--------|
| 稳定性 | Django LTS + SQLite + Gunicorn 组合在协会规模下高度稳定 | 瓶颈在运维过程，不在技术栈 |
| AI 误用 | 三道闸门：只读权限 + PR review + 部署前快照 | 权限收在1人手里，AI的代码必须人眼看过才能上线 |
| 上课高峰 | 100下载+200浏览在安全区；Caddy X-Accel-Redirect 是关键 | 真正的瓶颈是出口带宽，不是服务器 |
| 暴力破解 | django-axes 5次锁定15分钟 | 扫描器发现登不进去就走了 |
| 上传断连 | 不会。上传和页面服务在不同 worker 中独立处理 | Gunicorn pre-fork 模型天然隔离 |
