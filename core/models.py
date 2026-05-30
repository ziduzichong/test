from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """协会网站用户 — Member ≠ User。User 是操作者（谁能登录管理），Member 是对外展示名片。"""
    class Role(models.TextChoices):
        ADMIN = 'admin', '管理员'
        EDITOR = 'editor', '编辑者'

    display_name = models.CharField('显示名称', max_length=100, blank=True)
    role = models.CharField('角色', max_length=20, choices=Role.choices, default=Role.EDITOR)

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'


class Announcement(models.Model):
    """公告 — 新闻/课程/考核，支持富文本，默认草稿。"""
    class Category(models.TextChoices):
        NEWS = 'news', '新闻'
        COURSE = 'course', '课程'
        EXAM = 'exam', '考核'

    title = models.CharField('标题', max_length=200)
    content = models.TextField('内容', blank=True, default='')
    category = models.CharField('分类', max_length=20, choices=Category.choices, default=Category.NEWS)
    is_published = models.BooleanField('已发布', default=False)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='作者')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = '公告'
        verbose_name_plural = '公告'

    def __str__(self):
        return self.title


class Member(models.Model):
    """协会成员名片 — 对外展示用，可包含已毕业前辈。与 User 独立。"""
    name = models.CharField('姓名', max_length=100)
    position = models.CharField('职位', max_length=100, blank=True, default='')
    avatar = models.ImageField('头像', upload_to='avatars/', blank=True)
    bio = models.TextField('简介', blank=True, default='')
    contact = models.CharField('联系方式', max_length=200, blank=True, default='')
    contact_public = models.BooleanField('公开联系方式', default=False)
    skills = models.CharField('技能标签', max_length=500, blank=True, default='')
    joined_at = models.CharField('加入时间', max_length=50, blank=True, default='')
    order = models.IntegerField('排序', default=0)
    is_active = models.BooleanField('展示中', default=True)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ['order', '-created_at']
        verbose_name = '成员'
        verbose_name_plural = '成员'

    def __str__(self):
        return f'{self.name} — {self.position}'


class Award(models.Model):
    """奖项荣誉 — 展示协会竞赛成果。"""
    class Rank(models.TextChoices):
        GRAND = 'grand', '特等奖'
        FIRST = 'first', '一等奖'
        SECOND = 'second', '二等奖'
        THIRD = 'third', '三等奖'
        MERIT = 'merit', '优胜奖'
        OTHER = 'other', '其他'

    title = models.CharField('奖项名称', max_length=200)
    competition = models.CharField('竞赛名称', max_length=200, blank=True, default='')
    description = models.TextField('描述', blank=True, default='')
    rank = models.CharField('等级', max_length=20, choices=Rank.choices, default=Rank.OTHER)
    award_date = models.DateField('获奖日期', null=True, blank=True)
    members = models.ManyToManyField(Member, blank=True, verbose_name='获奖成员', related_name='awards')
    image = models.ImageField('证书照片', upload_to='awards/', blank=True)
    order = models.IntegerField('排序', default=0)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ['order', '-award_date']
        verbose_name = '奖项'
        verbose_name_plural = '奖项'

    def __str__(self):
        return f'{self.competition} — {self.get_rank_display()}'


class UploadedFile(models.Model):
    """上传文件 — 支持 7 种分类，可执行文件强制 SHA256。"""
    class Category(models.TextChoices):
        LEARNING = 'learning', '学习资料'
        PROJECT = 'project', '项目代码'
        CIRCUIT = 'circuit', '电路设计'
        FIRMWARE = 'firmware', '固件'
        VIDEO = 'video', '教学视频'
        TOOL = 'tool', '软件工具'
        INSTALLER = 'installer', '系统镜像'

    EXECUTABLE_EXTENSIONS = ('.exe', '.msi', '.apk', '.deb', '.rpm')

    file = models.FileField('文件', upload_to='uploads/%Y/%m/')
    original_name = models.CharField('原始文件名', max_length=500)
    category = models.CharField('分类', max_length=20, choices=Category.choices, default=Category.LEARNING)
    description = models.CharField('描述', max_length=500, blank=True, default='')
    sha256_hash = models.CharField('SHA256', max_length=64, blank=True, default='')
    is_public = models.BooleanField('公开下载', default=False)
    uploader = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='上传者')
    file_size = models.BigIntegerField('文件大小', default=0)
    download_count = models.IntegerField('下载次数', default=0)
    created_at = models.DateTimeField('上传时间', auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = '文件'
        verbose_name_plural = '文件'

    def __str__(self):
        return self.original_name

    @property
    def is_executable(self):
        import os
        return os.path.splitext(self.original_name)[1].lower() in self.EXECUTABLE_EXTENSIONS
