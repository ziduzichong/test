#!/bin/sh
set -e

# 如果 .env 不存在，从模板创建
if [ ! -f .env ]; then
    echo "[entrypoint] 创建 .env 配置文件..."
    cp .env.example .env
    # 生成随机 SECRET_KEY
    SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(50))")
    sed -i "s/SECRET_KEY=.*/SECRET_KEY=$SECRET_KEY/" .env
fi

# 等待数据库就绪（PostgreSQL 模式下有用）
# sleep 2

# 执行迁移
echo "[entrypoint] 数据库迁移..."
python manage.py migrate --noinput

# 首次运行：初始化管理员和种子数据
python manage.py setup --noinput 2>/dev/null || true

# 收集静态文件
echo "[entrypoint] 收集静态文件..."
python manage.py collectstatic --noinput

# 启动
echo "[entrypoint] 启动服务..."
exec gunicorn config.wsgi:application \
    --workers 4 \
    --threads 2 \
    --worker-class gthread \
    --timeout 120 \
    --bind 0.0.0.0:8000
