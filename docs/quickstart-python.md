# 零基础 5 分钟启动指南

> 写给完全没用过 Django 的新人。你只需要装过 Python 就行。

## 第一步：检查 Python

打开终端（Windows 按 Win+R 输入 `cmd`），输入：

```bash
python --version
```

如果显示 `Python 3.12.x` 或更高，继续。如果报错"找不到命令"，去 [python.org](https://python.org) 下载安装，**安装时勾选 "Add Python to PATH"**。

## 第二步：打开项目

```bash
cd esta-website
```

## 第三步：创建虚拟环境（只需做一次）

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

看到命令行前面出现 `(.venv)` 就成功了。

## 第四步：安装依赖（只需做一次）

```bash
pip install -r requirements.txt
```

等待 1-2 分钟，看到 `Successfully installed ...` 即可。

## 第五步：配置密钥（只需做一次）

```bash
# 复制环境变量模板
cp .env.example .env        # macOS/Linux
copy .env.example .env      # Windows

# 生成密钥
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

把输出的那串随机字符复制，打开 `.env` 文件，替换 `SECRET_KEY=your-secret-key-here` 为 `SECRET_KEY=你复制的那串字符`。

## 第六步：初始化数据库（只需做一次）

```bash
python manage.py migrate
python manage.py createsuperuser
# 用户名填 admin
# 邮箱可以不填（直接回车）
# 密码自己设，记住它
```

## 第七步：启动

```bash
python manage.py runserver
```

打开浏览器访问 `http://127.0.0.1:8000`。

看到协会首页了？成功了。

## 以后每次启动

```bash
cd esta-website
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS/Linux
python manage.py runserver
```

三行命令搞定。

## 网站挂了怎么办

```bash
# 1. 停掉（按 Ctrl+C）

# 2. 重新启动
python manage.py runserver

# 3. 如果还是报错，检查数据库
python manage.py check --deploy

# 4. 最坏情况：恢复备份
# 参见 docs/backup-restore.md
```

## 下一步

- 想改网站内容 → 看 `docs/development-python.md`
- 想了解系统设计 → 看 `docs/architecture-python.md`
- 想备份数据 → 看 `docs/backup-restore.md`
