FROM python:3.12-slim
WORKDIR /app

# 系统依赖：libmagic 用于文件类型检测（生产环境可用）
RUN apt-get update && apt-get install -y --no-install-recommends libmagic1 && rm -rf /var/lib/apt/lists/*

# Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 项目文件
COPY . .
RUN mkdir -p media/uploads data staticfiles

# 入口脚本
RUN chmod +x entrypoint.sh

EXPOSE 8000
CMD ["./entrypoint.sh"]
