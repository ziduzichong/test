from django.core.management.base import BaseCommand
from django.conf import settings
from pathlib import Path
import hashlib, os
from core.models import UploadedFile

EXT_TO_CATEGORY = {
    '.pdf': 'learning', '.doc': 'learning', '.docx': 'learning',
    '.ppt': 'learning', '.pptx': 'learning', '.xls': 'learning',
    '.xlsx': 'learning', '.txt': 'learning', '.md': 'learning', '.csv': 'learning',
    '.c': 'project', '.cpp': 'project', '.h': 'project', '.hpp': 'project',
    '.py': 'project', '.rs': 'project', '.go': 'project', '.java': 'project',
    '.js': 'project', '.ts': 'project', '.v': 'project', '.sv': 'project',
    '.ino': 'project', '.asm': 'project', '.zip': 'project', '.rar': 'project',
    '.7z': 'project',
    '.sch': 'circuit', '.pcb': 'circuit', '.brd': 'circuit',
    '.json': 'circuit', '.epro': 'circuit', '.prjpcb': 'circuit',
    '.hex': 'firmware', '.bin': 'firmware', '.elf': 'firmware', '.uf2': 'firmware',
    '.mp4': 'video', '.mov': 'video', '.avi': 'video', '.mkv': 'video', '.webm': 'video',
    '.exe': 'tool', '.msi': 'tool', '.apk': 'tool',
    '.deb': 'tool', '.rpm': 'tool', '.dmg': 'tool', '.tar': 'tool', '.gz': 'tool',
    '.iso': 'installer', '.img': 'installer',
}

class Command(BaseCommand):
    help = '批量导入文件到协会网站'

    def add_arguments(self, parser):
        parser.add_argument('source_dir', help='源文件目录')
        parser.add_argument('--default-category', default='learning',
                          choices=['learning','project','circuit','firmware','video','tool','installer'])
        parser.add_argument('--max-size', type=int, default=2147483648)
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--is-public', action='store_true', default=False, help='设为公开下载')

    def handle(self, **options):
        source = Path(options['source_dir'])
        if not source.exists():
            self.stderr.write(f'目录不存在: {source}')
            return

        total = success = skipped_dup = skipped_size = failed = 0
        files = [f for f in source.rglob('*') if f.is_file()]

        for f in files:
            total += 1
            size = f.stat().st_size

            if size > options['max_size']:
                skipped_size += 1
                self.stdout.write(f'  [SKIP] {f.name}: 超过大小限制 ({size/1e9:.1f}GB)')
                continue

            if UploadedFile.objects.filter(original_name=f.name, file_size=size).exists():
                skipped_dup += 1
                continue

            ext = f.suffix.lower()
            category = f.parent.name if f.parent != source else None
            if category not in dict(UploadedFile.Category.choices):
                category = EXT_TO_CATEGORY.get(ext, options['default_category'])

            if options['dry_run']:
                self.stdout.write(f'  [DRY] {f.name} → {category} ({size/1e6:.1f}MB)')
                success += 1
                continue

            sha256 = ''
            if ext in UploadedFile.EXECUTABLE_EXTENSIONS:
                sha256 = hashlib.sha256(f.read_bytes()).hexdigest()

            dest_dir = Path(settings.MEDIA_ROOT) / 'uploads' / category
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / f.name
            counter = 1
            while dest.exists():
                stem, suffix = os.path.splitext(f.name)
                dest = dest_dir / f'{stem}_{counter}{suffix}'
                counter += 1

            dest.write_bytes(f.read_bytes())

            UploadedFile.objects.create(
                original_name=f.name,
                file=str(dest.relative_to(settings.MEDIA_ROOT)),
                category=category,
                description='',
                sha256_hash=sha256,
                is_public=options['is_public'],
                file_size=size,
            )
            success += 1

            if success % 100 == 0:
                from django.db import transaction
                transaction.commit()

        self.stdout.write(self.style.SUCCESS(
            f'\n导入完成: {success}/{total} 成功'
            f' (跳过重复:{skipped_dup}, 超限:{skipped_size}, 失败:{failed})'
        ))
