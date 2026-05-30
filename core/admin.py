from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Announcement, Member, Award, UploadedFile


@admin.register(User)
class UserAdmin(UserAdmin):
    list_display = ('username', 'display_name', 'role', 'is_active', 'date_joined')
    list_filter = ('role', 'is_active')
    fieldsets = UserAdmin.fieldsets + (
        ('扩展信息', {'fields': ('display_name', 'role')}),
    )


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'is_published', 'author', 'created_at')
    list_filter = ('category', 'is_published')
    search_fields = ('title', 'content')
    date_hierarchy = 'created_at'


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('name', 'position', 'is_active', 'order', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'skills', 'bio')
    list_editable = ('order', 'is_active')


@admin.register(Award)
class AwardAdmin(admin.ModelAdmin):
    list_display = ('title', 'competition', 'rank', 'award_date', 'order')
    list_filter = ('rank',)
    search_fields = ('title', 'competition')
    filter_horizontal = ('members',)


@admin.register(UploadedFile)
class UploadedFileAdmin(admin.ModelAdmin):
    list_display = ('original_name', 'category', 'file_size', 'is_public', 'download_count', 'created_at')
    list_filter = ('category', 'is_public')
    search_fields = ('original_name', 'description')
    readonly_fields = ('file_size', 'download_count')
