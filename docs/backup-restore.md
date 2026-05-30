# 备份与恢复指南

## 备份内容

每次备份包含两部分：
1. **数据库** — 所有公告、成员、用户、文件记录等
2. **上传文件** — 所有上传的文档、视频、代码、安装包等

## 备份命令

### 一键备份（推荐）

```bash
# Linux / macOS / NAS
bash scripts/backup.sh

# Windows PowerShell
.\scripts\backup.ps1
```

### 手动备份

> 媒体文件 >10GB 时，tar.gz 全量压缩不现实。使用分级备份。

```bash
# 第1级：数据库备份（每天，秒级）
BACKUP_DIR="backups/$(date +%Y%m%d-%H%M)-db"
mkdir -p "$BACKUP_DIR"
cp data/db.sqlite3 "$BACKUP_DIR/"
cp data/db.sqlite3-wal "$BACKUP_DIR/" 2>/dev/null || true
cp data/db.sqlite3-shm "$BACKUP_DIR/" 2>/dev/null || true

# 第2级：媒体文件增量（rsync 只传差异）
rsync -a --delete media/uploads/ backups/latest/uploads/

# 清理旧备份
find backups/ -name "*-db" -mtime +30 -exec rm -rf {} \;
```

**Windows 用户注意**：如果 bash 不可用，用 PowerShell 运行 `scripts\backup.ps1`。

## 恢复命令

### 完全恢复

```bash
# 1. 找到要恢复的备份
ls backups/
# 例如: 20260101-1200-db/

# 2. 停止服务

# 3. 恢复数据库文件
cp backups/20260101-1200-db/db.sqlite3 data/
rm data/db.sqlite3-wal data/db.sqlite3-shm 2>/dev/null

# 4. 恢复媒体文件（从增量备份或周快照）
rsync -a backups/latest/uploads/ media/uploads/
# 或从周快照：rsync -a backups/weekly-20260101/uploads/ media/uploads/

# 5. 重启服务
python manage.py runserver
```

### 只恢复数据库（保留当前文件）

```bash
cp backups/20260101-1200-db/db.sqlite3 data/
rm data/db.sqlite3-wal data/db.sqlite3-shm 2>/dev/null
```

## NAS / Docker 环境

### 备份

```bash
# PostgreSQL 数据库（元数据，几MB，秒级完成）
docker compose -f docker-compose.nas.yml exec db pg_dump -U postgres esta > backups/$(date +%Y%m%d).sql

# 媒体文件增量（rsync，只传差异文件）
rsync -a --delete /mnt/nas/esta/uploads/ /mnt/nas/esta/backups/latest/uploads/
```

### 恢复

```bash
# 数据库
docker compose -f docker-compose.nas.yml exec -T db psql -U postgres esta < backups/20260101.sql

# 文件（从增量备份恢复）
rsync -a /mnt/nas/esta/backups/latest/uploads/ /mnt/nas/esta/uploads/
```

## 定时备份

### Linux / NAS (crontab)

```bash
# 编辑定时任务
crontab -e

# 每天凌晨 3:00 备份
0 3 * * * cd /path/to/esta-website && bash scripts/backup.sh
```

### Windows (任务计划程序)

1. 打开"任务计划程序"
2. 创建基本任务
3. 触发器：每天
4. 操作：启动程序 → `powershell.exe`
5. 参数：`-File "D:\esta-website\scripts\backup.ps1"`

## 备份检查清单

每月检查一次：

- [ ] 最近一次备份是否成功（检查 `backups/` 目录）
- [ ] 备份文件大小是否合理（不是 0 字节）
- [ ] 能否从备份恢复（在另一台机器上试恢复一次）
- [ ] 备份文件是否拷贝到另一台设备（防单点故障）

## 灾难恢复（网站完全挂了）

```bash
# 1. 在新机器上装 Python 3.12+
# 2. 克隆项目
git clone <仓库地址> esta-website
cd esta-website

# 3. 安装依赖
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 4. 从备份恢复
mkdir -p data media/uploads
cp /path/to/backup/db.sqlite3 data/
tar -xzf /path/to/backup/uploads.tar.gz -C media/

# 5. 初始化 + 启动
python manage.py migrate
python manage.py runserver
```

如果数据库文件也损坏了，用最近的一期备份重复以上步骤。
