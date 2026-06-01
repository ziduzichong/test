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

start http://127.0.0.1:8000
python manage.py runserver 0.0.0.0:8000
