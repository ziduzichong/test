import os
from django.core.exceptions import ValidationError

ALLOWED_EXTENSIONS = {
    'learning':  ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md', '.csv'],
    'project':   ['.c', '.cpp', '.h', '.hpp', '.py', '.rs', '.go', '.java', '.js', '.ts',
                  '.v', '.sv', '.ino', '.asm', '.zip', '.rar', '.7z'],
    'circuit':   ['.sch', '.pcb', '.brd', '.json', '.epro', '.prjpcb'],
    'firmware':  ['.hex', '.bin', '.elf', '.uf2'],
    'video':     ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
    'tool':      ['.exe', '.msi', '.apk', '.deb', '.rpm', '.dmg', '.tar', '.gz'],
    'installer': ['.iso', '.img'],
}

MAGIC_TO_CATEGORY = {
    'application/pdf': 'learning',
    'application/msword': 'learning',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'learning',
    'application/vnd.ms-powerpoint': 'learning',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'learning',
    'application/vnd.ms-excel': 'learning',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'learning',
    'text/plain': 'learning',
    'text/x-c': 'project',
    'text/x-python': 'project',
    'text/x-go': 'project',
    'text/x-java': 'project',
    'application/javascript': 'project',
    'application/zip': 'project',
    'application/x-rar': 'project',
    'application/x-7z-compressed': 'project',
    'application/x-tar': 'tool',
    'application/gzip': 'tool',
    'video/mp4': 'video',
    'video/quicktime': 'video',
    'video/x-msvideo': 'video',
    'video/x-matroska': 'video',
    'video/webm': 'video',
    'application/x-dosexec': 'tool',
    'application/x-msdownload': 'tool',
    'application/vnd.android.package-archive': 'tool',
    'application/vnd.debian.binary-package': 'tool',
    'application/x-redhat-package-manager': 'tool',
    'application/x-iso9660-image': 'installer',
    'application/x-elf': 'firmware',
    'text/x-asm': 'project',
}


def validate_extension(value, category):
    ext = os.path.splitext(value)[1].lower()
    allowed = ALLOWED_EXTENSIONS.get(category, [])
    if ext not in allowed:
        raise ValidationError(f'文件类型 ".{ext}" 不属于 "{category}" 分类')


def validate_magic_bytes(uploaded_file, claimed_category):
    """魔术字校验 — 需要 libmagic。Windows 开发环境不可用时跳过此校验。"""
    try:
        import magic
        header = uploaded_file.read(256)
        uploaded_file.seek(0)
        mime = magic.from_buffer(header, mime=True)
        expected = MAGIC_TO_CATEGORY.get(mime)
        if expected and expected != claimed_category:
            raise ValidationError(
                f'文件真实类型为 {mime}（{expected}），与你选择的分类 {claimed_category} 不匹配'
            )
    except (ImportError, OSError):
        pass  # 开发环境不可用，跳过
    except Exception:
        pass
