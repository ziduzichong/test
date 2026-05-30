# Django Migration 完全指南

> 写给换届技术负责人的数据库变更教程。读完能理解 migration 是什么、怎么用、出错了怎么修。

## 目录

1. [是什么](#1-是什么)
2. [常用命令](#2-常用命令)
3. [工作流：改模型→生成→应用](#3-工作流改模型生成应用)
4. [读懂 migration 文件](#4-读懂-migration-文件)
5. [换届时的 migration 检查](#5-换届时的-migration-检查)
6. [出错了怎么办](#6-出错了怎么办)
7. [绝对不要做的事](#7-绝对不要做的事)
8. [长期维护：合并旧 migration](#8-长期维护合并旧-migration)

---

## 1. 是什么

### 一句话

**Migration 是数据库结构的版本控制。** 就像 Git 记录代码变化，migration 记录数据库表结构的变化。

### 为什么需要它

```
没有 Migration 的世界：
  上一届："我们在 members 表加了个 phone 字段"
  你：    "什么时候加的？字段类型是什么？有没有默认值？"
  上一届："……我忘了"

有 Migration 的世界：
  $ python manage.py showmigrations
  members
    [X] 0001_initial
    [X] 0002_add_phone_field        ← 原来在这里加的
    [X] 0003_add_contact_public
```

### 文件在哪

```
apps/core/migrations/
├── __init__.py
├── 0001_initial.py          # 第1次：创建所有表
├── 0002_add_phone.py        # 第2次：加 phone 字段
├── 0003_add_contact.py      # 第3次：加 contact_public 字段
└── ...
```

每个文件编号递增，Django 按顺序执行。

---

## 2. 常用命令

```bash
# 查看所有 app 的 migration 状态
python manage.py showmigrations

# [X] = 已应用
# [ ] = 未应用

# 生成 migration（改完 models.py 后执行）
python manage.py makemigrations

# 应用所有未应用的 migration
python manage.py migrate

# 回退一个 migration
python manage.py migrate core 0002   # 退回到 0002 的状态

# 查看某个 migration 对应的 SQL（不实际执行）
python manage.py sqlmigrate core 0003

# 干跑：显示会执行什么 SQL，不实际执行
python manage.py migrate --plan
```

---

## 3. 工作流：改模型→生成→应用

### 场景：给公告加一个"置顶"字段

```bash
# 1. 修改 models.py
# apps/core/models.py
class Announcement(models.Model):
    ...
    is_pinned = models.BooleanField(default=False, verbose_name='置顶')
```

```bash
# 2. 生成 migration
python manage.py makemigrations

# 输出:
# Migrations for 'core':
#   core/migrations/0004_announcement_is_pinned.py
#     - Add field is_pinned to announcement
```

```bash
# 3. 检查生成的 migration（确认它做了你想做的事）
python manage.py sqlmigrate core 0004

# 输出:
# BEGIN;
# ALTER TABLE "core_announcement" ADD COLUMN "is_pinned" bool NOT NULL DEFAULT 0;
# COMMIT;
```

```bash
# 4. 应用到数据库
python manage.py migrate

# 输出:
# Operations to perform:
#   Apply all migrations: core
# Running migrations:
#   Applying core.0004_announcement_is_pinned... OK
```

```bash
# 5. 确认
python manage.py showmigrations core

# 应该看到:
#  [X] 0004_announcement_is_pinned
```

### 回退（如果改错了）

```bash
# 回到 0003 的状态（会删除 is_pinned 列！）
python manage.py migrate core 0003
```

> 回退会删除数据。如果已经有公告用了置顶功能，回退后置顶数据丢失。

---

## 4. 读懂 migration 文件

打开 `0004_announcement_is_pinned.py`：

```python
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_add_contact'),  # ← 依赖 0003，必须先执行 0003
    ]

    operations = [
        migrations.AddField(
            model_name='announcement',    # 改哪个模型
            name='is_pinned',            # 字段名
            field=models.BooleanField(default=False),  # 字段定义
        ),
    ]
```

每行含义：
- `dependencies`：这个 migration 依赖哪个 migration，Django 保证按顺序执行
- `operations`：具体要做的数据库操作（加字段、删字段、改字段、建表、删表）
- `model_name`：对应 `models.py` 里的类名（`Announcement`）

---

## 5. 换届时的 migration 检查

离任前和接任后各执行一次，确保 migration 状态干净。

### 离任前（上一届）

```bash
# 1. 确认全部 migration 已应用
python manage.py showmigrations

# 期望：所有行都是 [X]，没有 [ ]
# 如果有 [ ]，执行 migrate 补齐

# 2. 确认没有未提交的 migration 文件
git status

# 3. 如果有未提交的 migration，提交它
git add apps/core/migrations/
git commit -m "migration: 添加 xxx 字段"

# 4. 生成 migration 历史清单（给下一届）
python manage.py showmigrations > docs/migration-history-2026.txt
git add docs/migration-history-2026.txt
git commit -m "docs: 迁移历史快照"
```

### 接任后（下一届）

```bash
# 1. 拉代码 + 装依赖 + 激活虚拟环境
git pull
pip install -r requirements.txt

# 2. 查看 migration 状态
python manage.py showmigrations

# 3. 应用 migration
python manage.py migrate

# 4. 确认
python manage.py showmigrations
# 应该全部 [X]

# 5. 如果有报错 → 看第 6 节
```

---

## 6. 出错了怎么办

### 错误1："relation already exists"

```
django.db.utils.OperationalError: table "core_announcement" already exists
```

**原因**：数据库里有表，但 migration 记录里没有。

**排查**：
```bash
# 查看哪些 migration 认为"没执行"
python manage.py showmigrations
# 如果 0001_initial 显示 [ ] 但表实际存在 → 数据库和 migration 记录不同步
```

**修复**：
```bash
# 告诉 Django "这个 migration 已经执行过了，别重复执行"
python manage.py migrate core 0001 --fake
# 然后正常执行后续
python manage.py migrate
```

### 错误2："no such column"

```
django.db.utils.OperationalError: no such column: core_announcement.is_pinned
```

**原因**：migration 文件说字段已加，但数据库里没有。可能是有人手动改了数据库但没走 migration。

**修复**：
```bash
# 先看哪个 migration 应该已经执行
python manage.py showmigrations core
# 找到有问题的 migration 编号（比如 0004 状态是 [X] 但字段不存在）

# 回到上一个正确的状态
python manage.py migrate core 0003

# 重新应用
python manage.py migrate core 0004
```

### 错误3：migration 文件冲突

```
Conflicting migrations detected; multiple leaf nodes
```

**原因**：两个人同时生成 migration，都依赖 0003，生成了两个 0004。

**修复**：
```bash
# 合并两个 migration
python manage.py makemigrations --merge

# 会生成 0005_merge.py，自动处理依赖
python manage.py migrate
```

### 错误4：migration 依赖链断裂

```
django.db.migrations.exceptions.NodeNotFoundError
```

**原因**：有人删了 migration 文件但没删数据库里的记录。

**修复**：
```bash
# 1. 找出断裂点
python manage.py showmigrations
# 看哪个 migration 的依赖不存在

# 2. 从 Git 恢复被删的文件
git checkout -- apps/core/migrations/缺失的文件.py

# 3. 重新应用
python manage.py migrate
```

---

## 7. 绝对不要做的事

```markdown
❌ 不要删除 migration 文件
   → 数据库里记录着"已执行到 0010"，文件只有 0001-0005 → Django 崩溃

❌ 不要手动改 migration 文件里的依赖关系
   → 除非你完全理解依赖图

❌ 不要在生产环境用 migrate --fake 除非你知道为什么
   → --fake 只在表已存在但 migration 不知道时用

❌ 不要在 migrate 中途 Ctrl+C
   → 可能导致 migration 部分执行，数据库不一致

❌ 不要为了"清理"把所有 migration 删了重新生成
   → 已有数据可能丢失，表结构可能对不上

❌ 不要直接改数据库然后不生成 migration
   → 下一个接手的人不知道你改了什么
```

---

## 8. 长期维护：合并旧 migration

2 年后 migration 文件可能积累 20+ 个。可以压缩成一个：

```bash
# 把 0001-0015 合并为一个新的 0001_squashed
python manage.py squashmigrations core 0001 0015

# Django 会生成一个新的 migration 文件
# 包含了 0001-0015 所有操作的精简版本

# 注意：squash 后需要测试：
# 1. 在新数据库上 migrate 一遍，确认全部通过
# 2. 确认所有功能正常
# 3. 旧 migration 文件可以保留（Django 会自动用 squashed 版本）
```

> squash 不是必须的。20 个 migration 文件和 1 个合并文件效果一样，对性能没有影响。**只在"太乱了看不懂"时才 squash。**

---

## 快速参考卡片（打印放协会办公室）

```
┌─────────────────────────────────────────┐
│        Django Migration 速查卡           │
├─────────────────────────────────────────┤
│ 改模型后:  makemigrations → migrate     │
│ 看状态:    showmigrations               │
│ 看SQL:     sqlmigrate core 0004         │
│ 回退:      migrate core 0003           │
│ 合并冲突:  makemigrations --merge       │
│                                         │
│ 绝对不删 migration 文件！                │
│ 出问题先 showmigrations 看状态          │
│ 不确定就 git diff + 问 git log          │
└─────────────────────────────────────────┘
```
