# views_auth.py — 认证相关视图
# 登录、退出、修改密码

from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages


def login_view(request):
    """登录页面：GET 显示表单，POST 验证登录"""
    username = ''
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect('/dashboard/')
        messages.error(request, '用户名或密码错误')

    return render(request, 'auth/login.html', {
        'username': username,
    })


def logout_view(request):
    """退出登录：调用 logout() 后重定向到首页"""
    logout(request)
    return redirect('/')


@login_required
def password_change_view(request):
    """修改密码：GET 显示表单，POST 校验并更新密码"""
    if request.method == 'POST':
        old = request.POST.get('old_password', '')
        new = request.POST.get('new_password', '')
        confirm = request.POST.get('confirm_password', '')

        if not request.user.check_password(old):
            messages.error(request, '当前密码不正确')
        elif len(new) < 6:
            messages.error(request, '新密码至少 6 个字符')
        elif new != confirm:
            messages.error(request, '两次输入的新密码不一致')
        else:
            request.user.set_password(new)
            request.user.save()
            messages.success(request, '密码修改成功，请重新登录')
            # set_password() 会注销当前会话，重新认证
            return redirect('/login/')

    return render(request, 'auth/password_change.html')
