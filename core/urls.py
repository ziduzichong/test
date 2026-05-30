# urls.py — 全局 URL 路由
# 由 config/urls.py 通过 path('', include('core.urls')) 挂载

from django.urls import path
from . import views_public, views_auth, views_dashboard

urlpatterns = [
    # ============================================================
    # 公开页面
    # ============================================================
    path('', views_public.home, name='home'),
    path('announcements/', views_public.announcement_list, name='announcement_list'),
    path('announcements/<int:pk>/', views_public.announcement_detail, name='announcement_detail'),
    path('members/', views_public.member_list, name='member_list'),
    path('members/<int:pk>/', views_public.member_detail, name='member_detail'),
    path('awards/', views_public.award_list, name='award_list'),
    path('search/', views_public.search, name='search'),

    # ============================================================
    # 认证
    # ============================================================
    path('login/', views_auth.login_view, name='login'),
    path('logout/', views_auth.logout_view, name='logout'),
    path('password-change/', views_auth.password_change_view, name='password_change'),

    # ============================================================
    # 文件下载（需登录）
    # ============================================================
    path('files/<int:pk>/download/', views_dashboard.file_download, name='file_download'),

    # ============================================================
    # 仪表盘（需登录）
    # ============================================================
    path('dashboard/', views_dashboard.index, name='dashboard'),
    path('dashboard/files/', views_dashboard.file_list, name='dashboard_files'),
    path('dashboard/files/upload/', views_dashboard.file_upload, name='dashboard_upload'),
    path('dashboard/files/batch-delete/', views_dashboard.file_batch_delete, name='dashboard_batch_delete'),
    path('dashboard/announcements/', views_dashboard.announcement_manage, name='dashboard_announcements'),
    path('dashboard/members/', views_dashboard.member_manage, name='dashboard_members'),
    path('dashboard/awards/', views_dashboard.award_manage, name='dashboard_awards'),
    path('dashboard/accounts/', views_dashboard.account_manage, name='dashboard_accounts'),

    # ============================================================
    # HTMX API（需登录）
    # ============================================================
    path('api/announcements/<int:pk>/toggle/', views_dashboard.announcement_toggle, name='announcement_toggle'),
    path('api/files/<int:pk>/delete/', views_dashboard.file_delete_api, name='file_delete_api'),
    path('api/announcements/<int:pk>/delete/', views_dashboard.announcement_delete_api, name='announcement_delete_api'),
]
