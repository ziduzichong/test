#!/bin/bash
# =============================================================
# 电子科学与技术协会 — 一键部署脚本 (Ubuntu 22.04+)
# 用法: chmod +x deploy.sh && sudo ./deploy.sh
# =============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

DOMAIN="${DOMAIN:-}"               # 例: esta.example.com
APP_DIR="${APP_DIR:-/opt/esta}"    # 安装目录
APP_USER="${APP_USER:-esta}"       # 运行用户
NODE_PORT="${NODE_PORT:-3000}"     # Node.js 端口

# 检查是否root
[[ $EUID -eq 0 ]] || err "请用 sudo 运行此脚本"

log "===== 开始部署 电子科学与技术协会 ====="

# ---- 1. 系统更新 ----
log "更新系统包..."
apt-get update -y
apt-get upgrade -y

# ---- 2. 安装 Node.js 24.x ----
if ! command -v node &>/dev/null; then
  log "安装 Node.js 24.x..."
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
log "Node.js $(node -v) / npm $(npm -v)"

# ---- 3. 安装 Nginx ----
if ! command -v nginx &>/dev/null; then
  log "安装 Nginx..."
  apt-get install -y nginx
  systemctl enable nginx
fi

# ---- 4. 创建用户 ----
if ! id -u "$APP_USER" &>/dev/null; then
  log "创建系统用户: $APP_USER..."
  useradd -r -s /bin/false -m -d "$APP_DIR" "$APP_USER"
fi

# ---- 5. 创建应用目录 ----
log "设置应用目录: $APP_DIR..."
mkdir -p "$APP_DIR"/{data,public/uploads}
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ---- 6. 复制代码 ----
log "复制项目文件..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
rsync -a --delete \
  --exclude='node_modules' --exclude='.git' --exclude='data/*.db' \
  "$SCRIPT_DIR/" "$APP_DIR/"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ---- 7. 安装依赖 ----
log "安装 npm 依赖..."
cd "$APP_DIR"
sudo -u "$APP_USER" npm install --production

# ---- 8. 安装 PM2 并启动 ----
log "安装 PM2 进程管理器..."
npm install -g pm2

log "启动应用..."
sudo -u "$APP_USER" pm2 delete esta 2>/dev/null || true
sudo -u "$APP_USER" pm2 start server.js \
  --name esta \
  --env NODE_ENV=production

sudo -u "$APP_USER" pm2 save
sudo env PATH="$PATH:$(npm bin -g)" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null || true

# ---- 9. 配置 Nginx ----
log "配置 Nginx 反向代理..."
cat > /etc/nginx/sites-available/esta.conf << 'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 60M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 上传文件目录（直接通过 Nginx 加速）
    location /uploads/ {
        alias /opt/esta/public/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/esta.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---- 10. 配置域名和 SSL（如果有域名） ----
if [[ -n "$DOMAIN" ]]; then
  log "配置域名: $DOMAIN..."
  sed -i "s/server_name _;/server_name $DOMAIN;/" /etc/nginx/sites-available/esta.conf

  if command -v certbot &>/dev/null || apt-get install -y certbot python3-certbot-nginx; then
    log "申请 SSL 证书..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@${DOMAIN}" || \
    warn "SSL 证书申请失败，稍后手动运行: certbot --nginx -d $DOMAIN"
  fi
  systemctl reload nginx
fi

# ---- 11. 防火墙 ----
if command -v ufw &>/dev/null; then
  log "配置防火墙..."
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 22/tcp
  ufw --force enable 2>/dev/null || true
fi

# ---- 12. 验证 ----
sleep 2
if curl -sf http://127.0.0.1:$NODE_PORT/ > /dev/null; then
  log "网站部署成功!"
  log "本地访问: http://127.0.0.1"
  [[ -n "$DOMAIN" ]] && log "域名访问: https://$DOMAIN"
  log "PM2 管理: pm2 status, pm2 logs esta"
else
  warn "服务器启动中，请稍后检查: curl http://127.0.0.1:$NODE_PORT/"
fi

log "=============================="
log "默认管理员账号: admin"
log "默认管理员密码: admin123"
log "请及时修改密码！"
log "=============================="
