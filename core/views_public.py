# views_public.py — 公开页面视图
# 供所有访客访问，无需登录

from django.shortcuts import render, get_object_or_404
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import FileResponse, Http404
from core.models import Announcement, Member, Award, UploadedFile


def home(request):
    """首页：最新 4 条已发布公告 + 最近 6 个活跃成员 + 最近 3 个奖项"""
    announcements = Announcement.objects.filter(is_published=True)[:4]
    members = Member.objects.filter(is_active=True)[:6]
    awards = Award.objects.all()[:3]
    return render(request, 'public/home.html', {
        'announcements': announcements,
        'members': members,
        'awards': awards,
    })


def announcement_list(request):
    """公告列表：支持 ?category=news|course|exam 筛选，每页 20 条"""
    category = request.GET.get('category')
    qs = Announcement.objects.filter(is_published=True)
    if category in ('news', 'course', 'exam'):
        qs = qs.filter(category=category)

    paginator = Paginator(qs, 20)
    page = request.GET.get('page', 1)
    announcements = paginator.get_page(page)

    return render(request, 'public/announcements.html', {
        'announcements': announcements,
        'current_category': category,
    })


def announcement_detail(request, pk):
    """公告详情：仅展示已发布的公告"""
    announcement = get_object_or_404(Announcement, pk=pk, is_published=True)
    return render(request, 'public/announcement_detail.html', {
        'announcement': announcement,
    })


def member_list(request):
    """成员列表：仅展示活跃成员（is_active=True）"""
    members = Member.objects.filter(is_active=True)
    return render(request, 'public/members.html', {
        'members': members,
    })


def member_detail(request, pk):
    """成员详情：仅展示活跃成员"""
    member = get_object_or_404(Member, pk=pk, is_active=True)
    return render(request, 'public/member_detail.html', {
        'member': member,
    })


def award_list(request):
    """奖项列表：展示全部奖项"""
    awards = Award.objects.all()
    return render(request, 'public/awards.html', {
        'awards': awards,
    })


def search(request):
    """搜索：?q=xxx 搜索公告标题/内容（已发布）；已登录用户同时搜索文件"""
    query = request.GET.get('q', '').strip()
    announcements = []
    files = []

    if query:
        # 搜索已发布的公告，最多 20 条
        announcements = Announcement.objects.filter(
            Q(title__icontains=query) | Q(content__icontains=query),
            is_published=True,
        )[:20]

        # 仅登录用户可搜索文件，最多 50 条
        if request.user.is_authenticated:
            files = UploadedFile.objects.filter(
                Q(original_name__icontains=query) | Q(description__icontains=query),
            )[:50]

    return render(request, 'public/search.html', {
        'query': query,
        'announcements': announcements,
        'files': files,
    })


def public_file_list(request):
    """公开文件列表：仅展示 is_public=True 的文件，无需登录"""
    category = request.GET.get('category')
    qs = UploadedFile.objects.filter(is_public=True)
    if category:
        qs = qs.filter(category=category)
    return render(request, 'public/files.html', {
        'files': qs,
        'current_category': category,
    })


def public_file_download(request, pk):
    """公开文件下载：仅允许下载 is_public=True 的文件，无需登录"""
    f = get_object_or_404(UploadedFile, pk=pk, is_public=True)
    f.download_count += 1
    f.save(update_fields=['download_count'])
    try:
        return FileResponse(f.file.open('rb'), as_attachment=True, filename=f.original_name)
    except FileNotFoundError:
        raise Http404('文件不存在')
