# views_dashboard.py — 仪表盘视图
# 所有视图均需 @login_required，部分视图仅 admin 可访问

from functools import wraps
import os
import hashlib

from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponseForbidden, JsonResponse, FileResponse
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.conf import settings
from django.db.models import Sum
from core.models import User, Announcement, Member, Award, UploadedFile
from core.validators import validate_extension


# ============================================================
# 辅助装饰器
# ============================================================

def require_admin(view_func):
    """自定义装饰器：仅允许 admin 角色访问"""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if request.user.role != 'admin':
            return HttpResponseForbidden('需要管理员权限')
        return view_func(request, *args, **kwargs)
    return wrapper


# ============================================================
# 仪表盘首页
# ============================================================

@login_required
def index(request):
    """仪表盘首页：统计总文件数、公告数、成员数、下载次数"""
    total_downloads = UploadedFile.objects.aggregate(
        total=Sum('download_count')
    )['total'] or 0

    context = {
        'file_count': UploadedFile.objects.count(),
        'announcement_count': Announcement.objects.count(),
        'member_count': Member.objects.filter(is_active=True).count(),
        'total_downloads': total_downloads,
    }
    return render(request, 'dashboard/index.html', context)


# ============================================================
# 文件管理
# ============================================================

@login_required
def file_list(request):
    """文件列表：支持 ?category=xxx 筛选"""
    category = request.GET.get('category')
    qs = UploadedFile.objects.all()
    if category:
        qs = qs.filter(category=category)
    return render(request, 'dashboard/files.html', {
        'files': qs,
        'current_category': category,
    })


@login_required
def file_upload(request):
    """文件上传：校验扩展名 + 魔术字，可执行文件强制计算 SHA256"""
    from core.models import UploadedFile
    categories = UploadedFile.Category.choices
    context = {'categories': categories}

    if request.method == 'POST':
        uploaded = request.FILES.get('file')
        category = request.POST.get('category', '')
        description = request.POST.get('description', '')
        is_public = request.POST.get('is_public') == 'on'

        # 校验：文件是否选择
        if not uploaded:
            messages.error(request, '请选择文件')
            return render(request, 'dashboard/upload.html', context)

        # 校验：文件大小
        if uploaded.size > settings.FILE_UPLOAD_MAX_SIZE:
            messages.error(request, f'文件大小超过限制（最大 {settings.FILE_UPLOAD_MAX_SIZE // 1048576} MB）')
            return render(request, 'dashboard/upload.html', context)

        # 校验：扩展名
        try:
            validate_extension(uploaded.name, category)
        except Exception as e:
            messages.error(request, str(e))
            return render(request, 'dashboard/upload.html', context)

        # 判断是否可执行文件
        ext = os.path.splitext(uploaded.name)[1].lower()
        is_exec = ext in UploadedFile.EXECUTABLE_EXTENSIONS

        # 计算 SHA256（仅可执行文件）
        sha256_hash = ''
        if is_exec:
            uploaded.seek(0)
            sha256 = hashlib.sha256()
            for chunk in uploaded.chunks():
                sha256.update(chunk)
            sha256_hash = sha256.hexdigest()
            uploaded.seek(0)  # 重置指针供后续存储使用

        # 创建数据库记录
        UploadedFile.objects.create(
            file=uploaded,
            original_name=uploaded.name,
            category=category,
            description=description,
            is_public=is_public,
            uploader=request.user,
            file_size=uploaded.size,
            sha256_hash=sha256_hash,
        )

        messages.success(request, f'文件 "{uploaded.name}" 上传成功')
        return redirect('/dashboard/files/')

    return render(request, 'dashboard/upload.html', context)


@login_required
def file_download(request, pk):
    """文件下载：递增下载次数后返回 FileResponse"""
    file_obj = get_object_or_404(UploadedFile, pk=pk)
    file_obj.download_count += 1
    file_obj.save(update_fields=['download_count'])
    return FileResponse(
        file_obj.file.open('rb'),
        as_attachment=True,
        filename=file_obj.original_name,
    )


@login_required
@require_admin
def file_batch_delete(request):
    """批量删除文件：GET 显示待选列表，POST 删除选中文件（含磁盘文件）"""
    if request.method == 'POST':
        file_ids = request.POST.getlist('file_ids')
        files = UploadedFile.objects.filter(id__in=file_ids)
        for f in files:
            f.file.delete(save=False)  # 删除物理文件
        deleted_count = files.count()
        files.delete()
        messages.success(request, f'已批量删除 {deleted_count} 个文件')
        return redirect('/dashboard/files/')

    files = UploadedFile.objects.all()
    return render(request, 'dashboard/batch_delete.html', {'files': files})


# ============================================================
# 公告管理
# ============================================================

@login_required
def announcement_manage(request):
    """公告管理：GET 展示列表（含草稿），POST 创建或编辑公告（通过 id 参数区分）"""
    if request.method == 'POST':
        ann_id = request.POST.get('id')
        title = request.POST.get('title', '').strip()
        content = request.POST.get('content', '')
        category = request.POST.get('category', 'news')
        is_published = request.POST.get('is_published') == 'on'

        if not title:
            messages.error(request, '标题不能为空')
        elif ann_id:
            # 编辑已有公告
            ann = get_object_or_404(Announcement, pk=ann_id)
            ann.title = title
            ann.content = content
            ann.category = category
            ann.is_published = is_published
            ann.save()
            messages.success(request, '公告已更新')
        else:
            # 创建新公告
            Announcement.objects.create(
                title=title,
                content=content,
                category=category,
                is_published=is_published,
                author=request.user,
            )
            messages.success(request, '公告已创建')

        return redirect('/dashboard/announcements/')

    announcements = Announcement.objects.all()
    return render(request, 'dashboard/announcements.html', {
        'announcements': announcements,
    })


# ============================================================
# 成员管理
# ============================================================

@login_required
def member_manage(request):
    """成员管理：GET 展示列表，POST 创建/编辑/删除成员"""
    if request.method == 'POST':
        # 删除操作
        if request.POST.get('_delete') == '1':
            member = get_object_or_404(Member, pk=request.POST.get('id'))
            member.delete()
            messages.success(request, '成员已删除')
            return redirect('/dashboard/members/')

        member_id = request.POST.get('id')
        name = request.POST.get('name', '').strip()
        position = request.POST.get('position', '')
        bio = request.POST.get('bio', '')
        contact = request.POST.get('contact', '')
        contact_public = request.POST.get('contact_public') == 'on'
        skills = request.POST.get('skills', '')
        joined_at = request.POST.get('joined_at', '')
        order = request.POST.get('order', 0)
        is_active = request.POST.get('is_active') == 'on'

        if not name:
            messages.error(request, '姓名不能为空')
        elif member_id:
            # 编辑已有成员
            member = get_object_or_404(Member, pk=member_id)
            member.name = name
            member.position = position
            if request.FILES.get('avatar'):
                member.avatar = request.FILES['avatar']
            member.bio = bio
            member.contact = contact
            member.contact_public = contact_public
            member.skills = skills
            member.joined_at = joined_at
            member.order = int(order) if order else 0
            member.is_active = is_active
            member.save()
            messages.success(request, '成员信息已更新')
        else:
            # 创建新成员
            Member.objects.create(
                name=name,
                position=position,
                avatar=request.FILES.get('avatar'),
                bio=bio,
                contact=contact,
                contact_public=contact_public,
                skills=skills,
                joined_at=joined_at,
                order=int(order) if order else 0,
                is_active=is_active,
            )
            messages.success(request, '成员已创建')

        return redirect('/dashboard/members/')

    members = Member.objects.all()
    return render(request, 'dashboard/members.html', {
        'members': members,
    })


# ============================================================
# 奖项管理
# ============================================================

@login_required
def award_manage(request):
    """奖项管理：GET 展示列表，POST 创建/编辑/删除"""
    if request.method == 'POST':
        # 删除操作
        if request.POST.get('_delete') == '1':
            award = get_object_or_404(Award, pk=request.POST.get('id'))
            award.delete()
            messages.success(request, '奖项已删除')
            return redirect('/dashboard/awards/')

        award_id = request.POST.get('id')
        title = request.POST.get('title', '').strip()
        competition = request.POST.get('competition', '')
        rank = request.POST.get('rank', 'other')
        description = request.POST.get('description', '')
        award_date = request.POST.get('award_date', '') or None

        if not title:
            messages.error(request, '奖项名称不能为空')
        elif award_id:
            award = get_object_or_404(Award, pk=award_id)
            award.title = title
            award.competition = competition
            award.rank = rank
            award.description = description
            if award_date:
                award.award_date = award_date
            award.save()
            messages.success(request, '奖项已更新')
        else:
            Award.objects.create(
                title=title, competition=competition, rank=rank,
                description=description, award_date=award_date,
            )
            messages.success(request, '奖项已创建')
        return redirect('/dashboard/awards/')

    awards = Award.objects.all()
    return render(request, 'dashboard/awards.html', {
        'awards': awards,
    })


# ============================================================
# 账户管理（仅 admin）
# ============================================================

@login_required
@require_admin
def account_manage(request):
    """账户管理：GET 展示用户列表，POST 创建新用户"""
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        display_name = request.POST.get('display_name', '')
        role = request.POST.get('role', 'editor')

        if not username or not password:
            messages.error(request, '用户名和密码不能为空')
        elif User.objects.filter(username=username).exists():
            messages.error(request, '用户名已存在')
        else:
            User.objects.create_user(
                username=username,
                password=password,
                display_name=display_name,
                role=role,
            )
            messages.success(request, f'用户 "{username}" 创建成功')

        return redirect('/dashboard/accounts/')

    users = User.objects.all()
    return render(request, 'dashboard/accounts.html', {
        'users': users,
    })


# ============================================================
# HTMX API
# ============================================================

@login_required
def announcement_toggle(request, pk):
    """切换公告发布状态：POST 请求，返回 JSON"""
    if request.method == 'POST':
        ann = get_object_or_404(Announcement, pk=pk)
        ann.is_published = not ann.is_published
        ann.save(update_fields=['is_published'])
        return JsonResponse({'ok': True, 'is_published': ann.is_published})
    return JsonResponse({'ok': False}, status=405)


@login_required
def file_delete_api(request, pk):
    """删除文件（API）：POST 删除数据库记录及磁盘文件，返回 JSON"""
    if request.method == 'POST':
        f = get_object_or_404(UploadedFile, pk=pk)
        f.file.delete(save=False)  # 删除物理文件
        f.delete()
        return JsonResponse({'ok': True})
    return JsonResponse({'ok': False}, status=405)


@login_required
def announcement_delete_api(request, pk):
    """删除公告（API）：POST 删除公告，返回 JSON"""
    if request.method == 'POST':
        ann = get_object_or_404(Announcement, pk=pk)
        ann.delete()
        return JsonResponse({'ok': True})
    return JsonResponse({'ok': False}, status=405)


@login_required
def upload_image(request):
    """Quill 编辑器图片上传：保存到 media/uploads/images/，返回 URL"""
    if request.method == 'POST':
        img = request.FILES.get('image')
        if not img:
            return JsonResponse({'ok': False, 'error': '未选择图片'}, status=400)
        import os, time
        from django.conf import settings
        from django.core.files.storage import default_storage
        ext = os.path.splitext(img.name)[1] or '.png'
        name = f'uploads/images/{int(time.time())}_{img.name}'
        path = default_storage.save(name, img)
        return JsonResponse({'ok': True, 'url': settings.MEDIA_URL + path})
    return JsonResponse({'ok': False}, status=405)
