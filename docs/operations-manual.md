# 运维手册

> 协会技术负责人的日常操作指南。涵盖启动/停止、用户管理、内容管理、备份恢复、故障排查和安全管理。

## 目录

1. [日常操作](#1-日常操作)
2. [用户管理](#2-用户管理)
3. [内容管理](#3-内容管理)
4. [监控与日志](#4-监控与日志)
5. [安全管理](#5-安全管理)
6. [故障排查](#6-故障排查)
7. [紧急恢复](#7-紧急恢复)
8. [定期维护清单](#8-定期维护清单)

---

## 1. 日常操作

### 启动网站

```bash
cd esta-website
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate         # Windows

# 开发模式
python manage.py runserver

# Docker 生产模式
docker compose up -d
docker compose logs -f            # 查看日志
```

### 停止网站

```bash
# 开发模式：Ctrl + C

# Docker 模式
docker compose down
```

### 重启

```bash
docker compose restart            # 快速重启（不重建镜像）
docker compose up -d --build      # 重建并启动（代码更新后）
```

### 检查运行状态

```bash
# Docker 容器状态
docker compose ps

# Django 健康检查
curl http://localhost:8000/

# 数据库状态
python manage.py check --deploy
```

---

## 2. 用户管理

### 创建新用户

```bash
# 命令行方式（推荐，安全）
python manage.py createsuperuser
# 交互式：输入用户名、邮箱（可跳过）、密码

# 或通过 Django Admin
# 访问 http://服务器/admin/ → 用户 → 添加用户
```

### 修改用户密码

```bash
python manage.py changepassword <用户名>
```

### 修改用户角色

Django Admin → 用户 → 选中用户 → 修改 `role` 字段：
- `admin`：最高权限，可批量删除、创建账号、访问 Admin
- `editor`：可上传下载、编辑公告成员

### 禁用用户（不删除，保留记录）

Django Admin → 用户 → 取消勾选 `is_active`

### 查看用户列表

```bash
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
for u in User.objects.all():
    print(f'{u.username} | {u.display_name} | {u.role} | active={u.is_active}')
"
```

---

## 3. 内容管理

### 发布公告

1. 登录网站 → 管理面板 → 公告管理 → 新建公告
2. 标题 + 分类（news/course/exam）+ 富文本内容
3. 保存为草稿 → 预览 → 确认无误 → 发布

### 上传文件（日常少量）

1. 管理面板 → 文件管理 → 上传文件
2. 选择分类 → 拖拽文件 → 上传

### 批量导入大量资料

```bash
# 不使用网页上传。走管理命令：
python manage.py bulk_import /path/to/files/

# 先干跑看效果
python manage.py bulk_import /path/to/files/ --dry-run
```

详见 `docs/bulk-data-guide.md`。

### 批量删除文件（仅 admin）

1. 管理面板 → 文件管理 → 批量删除
2. 勾选文件 → 确认删除

> 不可恢复。删除前确认备份有效。

### 添加/更新成员信息

管理面板 → 成员管理 → 添加/编辑成员。

### 添加奖项

管理面板 → 奖项管理 → 添加奖项 → 选择获奖成员。

---

## 4. 监控与日志

### 查看访问日志

```bash
# Caddy 访问日志
docker compose logs caddy | grep "GET"

# Django 日志
docker compose logs app
```

### 查看错误日志

```bash
# 最近 100 条错误
docker compose logs app | grep -i error | tail -100

# Django 500 错误
docker compose logs app | grep "500"
```

### 查看登录失败记录

```bash
# django-axes 记录了所有失败尝试
python manage.py shell -c "
from axes.models import AccessAttempt
for a in AccessAttempt.objects.all().order_by('-attempt_time')[:20]:
    print(f'{a.attempt_time} | {a.ip_address} | {a.username} | failures={a.failures_since_start}')
"
```

### 磁盘空间

```bash
# 查看上传文件占用
du -sh media/uploads/

# 各类别占用
du -sh media/uploads/*/

# 数据库大小
ls -lh data/db.sqlite3

# 总磁盘使用
df -h
```

### 简单健康检查脚本

```bash
#!/bin/bash
# health-check.sh — 放在 crontab 里每 30 分钟跑一次

URL="http://localhost:8000/"
if ! curl -s -o /dev/null -w "%{http_code}" "$URL" | grep -q 200; then
    echo "[$(date)] 网站无响应！" >> health-alert.log
    # 如果有企业微信/钉钉机器人，在这里加通知
fi
```

---

## 5. 安全管理

### 定期更新依赖

```bash
# 查看哪些包有更新
pip list --outdated

# 更新 Django（安全补丁最重要）
pip install --upgrade django

# 更新所有包（谨慎，可能有 breaking changes）
pip install --upgrade -r requirements.txt

# 更新后测试
python manage.py test
python manage.py check --deploy
```

### 查看登录攻击

```bash
# django-axes 统计
python manage.py shell -c "
from axes.models import AccessAttempt
from django.db.models import Count
for item in AccessAttempt.objects.values('ip_address').annotate(c=Count('id')).filter(c__gt=3).order_by('-c')[:10]:
    print(f'{item[\"ip_address\"]}: {item[\"c\"]} 次失败')
"

# 手动解锁一个 IP
python manage.py axes_reset_ip <IP地址>

# 手动解锁一个用户
python manage.py axes_reset_username <用户名>
```

### 封禁恶意 IP

```bash
# 在 Caddyfile 里添加：
# @blocked {
#     remote_ip 1.2.3.4 5.6.7.8
# }
# respond @blocked 403

# 或者用 iptables（Linux）
iptables -A INPUT -s 恶意IP -j DROP
```

### 安全检查清单

```bash
# 每次部署后执行
python manage.py check --deploy

# 确认：
# [ ] DEBUG = False
# [ ] SECRET_KEY 不是默认值
# [ ] ALLOWED_HOSTS 不是 "*"
# [ ] django-axes 正常工作
# [ ] 最近的 Django 安全更新已安装
```

---

## 6. 故障排查

### 网站打不开

```bash
# 1. Docker 在跑吗？
docker compose ps
# 所有服务状态应该 "Up"

# 2. Django 在响应吗？
curl http://localhost:8000/
# 应该返回 HTML

# 3. Caddy 在响应吗？
curl http://localhost/
# 应该返回 HTML（HTTP）或重定向到 HTTPS

# 4. 端口被占了吗？
lsof -i :80
lsof -i :443
lsof -i :8000

# 5. 磁盘满了吗？
df -h

# 6. 内存够吗？
free -h
```

### "Database is locked" 错误

```bash
# SQLite 写锁冲突。通常发生在：
# - 有人在上传大文件的同时有人在管理面板操作
# - 并发写入超过 SQLite 处理能力

# 临时解决：重启服务
docker compose restart app

# 永久解决：
# - 确认 SQLite WAL 模式已启用
# - 如果频繁出现 → 升级到 PostgreSQL
```

### 文件下载慢

```bash
# 检查带宽使用
iftop          # Linux
nethogs        # 按进程看带宽

# 检查 Caddy 是否在处理下载（而不是 Django）
docker compose logs caddy | grep "GET /files"

# 大文件下载慢是正常的（出口带宽瓶颈）
# 如果小文件也慢 → 检查磁盘 I/O
iostat -x 1
```

### 证书错误（HTTPS 失效）

```bash
# Caddy 通常自动续期，但可能失败：
docker compose logs caddy | grep -i cert

# 手动触发续期
docker compose exec caddy caddy renew

# 如果域名过期 → 先去续费域名
# 如果 DNS 改过 → 等 DNS 生效（最多 48 小时）
```

### 500 Internal Server Error

```bash
# 查看 Django 错误
docker compose logs app | tail -50

# 常见原因：
# - 数据库文件损坏
# - 磁盘满导致写入失败
# - migration 未执行
# - .env 配置错误
```

---

## 7. 紧急恢复

### 网站完全崩溃 → 从头恢复

```bash
# 1. 找到最近备份
ls -t backups/

# 2. 停掉当前服务
docker compose down

# 3. 恢复数据库
cp backups/20260101-1200-db/db.sqlite3 data/
rm data/db.sqlite3-wal data/db.sqlite3-shm

# 4. 恢复文件
rsync -a backups/latest/uploads/ media/uploads/

# 5. 重启
docker compose up -d

# 6. 确认恢复
curl http://localhost:8000/
```

### 数据库损坏

```bash
# SQLite 检查
sqlite3 data/db.sqlite3 "PRAGMA integrity_check;"
# 应该输出 "ok"

# 如果不 ok → 从备份恢复数据库（文件恢复很快）
cp backups/latest-db/db.sqlite3 data/
```

### 被人恶意删了文件

```bash
# 从最新备份恢复媒体文件
rsync -a backups/latest/uploads/ media/uploads/

# 数据库里文件记录还在（只是文件丢了），
# 恢复文件后下载功能恢复正常
```

### Docker 本身坏了

```bash
# NAS 上 Docker 套件故障 → 用 NAS 管理界面重启 Docker
# 还是不行 → 用虚拟环境直接跑（不依赖 Docker）：

source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000
# 临时方案，等 Docker 修好再切回去
```

---

## 8. 定期维护清单

### 每天

- [ ] 看一眼 `docker compose ps`（30秒）

### 每周

- [ ] 检查磁盘空间 `df -h`（1分钟）
- [ ] 确认备份脚本正常运行（检查 `backups/` 有今天的文件）
- [ ] 看一眼 django-axes 登录失败记录

### 每月

- [ ] `pip list --outdated` 检查依赖更新
- [ ] `python manage.py check --deploy` 安全检查
- [ ] 从备份在本地恢复一次，确认备份可用（重要！）
- [ ] 清理旧备份（保留最近 30 天）

### 每学期

- [ ] 更新 Django 安全补丁 `pip install --upgrade django`
- [ ] 检查域名续费状态
- [ ] 确认 SSL 证书自动续期正常
- [ ] 生成 `showmigrations` 快照存档
- [ ] 整理 `media/uploads/` 清理无用文件

### 换届前

- [ ] 执行完整备份并验证
- [ ] 生成 `showmigrations` 快照
- [ ] 更新 `.env` 中的 SECRET_KEY
- [ ] 将本手册打印版交给下一届
- [ ] 带下一届走一遍"启动-备份-恢复-停止"流程
- [ ] 确认下一届能独立完成上述流程

---

> 遇到本手册没覆盖的问题？先查 `docs/` 目录下的其他文档，再找不到就联系上一届技术负责人。
