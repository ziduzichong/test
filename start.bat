@echo off
cd /d "%~dp0"

if not exist .venv (
    python -m venv .venv
    call .venv\Scripts\activate
    pip install -r requirements.txt
    copy .env.example .env >nul
    python manage.py setup --noinput
) else (
    call .venv\Scripts\activate
)

:: 自动找空闲端口
set PORT=8000
:tryport
netstat -ano | findstr ":%PORT% " >nul
if %errorlevel%==0 (
    set /a PORT+=1
    if %PORT% lss 9000 goto tryport
)

start http://127.0.0.1:%PORT%
echo.
echo ====================================
echo   访问地址: http://127.0.0.1:%PORT%
echo   管理员:   admin / admin123
echo   按 Ctrl+C 停止
echo ====================================
echo.
python manage.py runserver 0.0.0.0:%PORT%
pause
