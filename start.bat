@echo off
chcp 65001 >nul
title 电子科学与技术协会网站

echo ================================================
echo   电子科学与技术协会网站 — 一键启动
echo ================================================
echo.

cd /d "%~dp0"

:: 检查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 python 命令
    echo 请安装 Python 3.12+ https://python.org
    echo 安装时勾选 "Add Python to PATH"
    pause
    exit /b 1
)

:: 创建虚拟环境
if not exist .venv (
    echo [1/4] 创建虚拟环境...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [错误] 创建虚拟环境失败，尝试用 Anaconda Python...
        E:\Anaconda\python.exe -m venv .venv 2>nul
        if %errorlevel% neq 0 (
            echo [错误] 无法创建虚拟环境
            pause
            exit /b 1
        )
    )
) else (
    echo [1/4] 虚拟环境已存在
)

:: 激活虚拟环境并安装依赖
echo [2/4] 安装依赖...
call .venv\Scripts\activate.bat
pip install -r requirements.txt -q

:: 创建配置文件
if not exist .env (
    echo [3/4] 创建配置文件...
    copy .env.example .env >nul
)

:: 初始化数据库
echo [4/4] 初始化数据库...
python manage.py setup --noinput
if %errorlevel% neq 0 (
    echo [警告] 初始化可能不完整，尝试继续启动...
)

echo.
echo ================================================
echo   启动完成！浏览器打开 http://127.0.0.1:8000
echo   管理员: admin / admin123
echo   按 Ctrl+C 停止服务器
echo ================================================
echo.

python manage.py runserver 0.0.0.0:8000

pause
