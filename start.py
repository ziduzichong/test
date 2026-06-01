"""一键启动 — 自动找空闲端口并打开浏览器"""
import os, socket, webbrowser, subprocess, sys, time, threading

BASE = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE)

def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p

port = free_port()
url = f'http://127.0.0.1:{port}'

print(f'\n  访问地址: {url}')
print(f'  管理员:   admin / admin123')
print(f'  按 Ctrl+C 停止\n')

# 延迟打开浏览器（等 Django 启动）
def open_browser():
    time.sleep(1.5)
    webbrowser.open(url)

threading.Thread(target=open_browser, daemon=True).start()

# 启动 Django
subprocess.run([sys.executable, 'manage.py', 'runserver', f'0.0.0.0:{port}'])
