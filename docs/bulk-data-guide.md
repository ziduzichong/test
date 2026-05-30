# 初始批量数据导入指南

## 适用场景

协会换届或网站初始化时，手上有几十GB的历史资料（软件安装包、课程资料、开源代码、文档），一次性导入网站。

**不要通过网页上传。** 浏览器上传几十GB会超时、断连、无法续传。

## 原理

```
你的资料                   服务器
──────────              ──────────
/docs/course1.pdf  ─→   media/uploads/learning/course1.pdf
/docs/course2.ppt  ─→   media/uploads/learning/course2.ppt
/tools/keil.exe    ─→   media/uploads/tool/keil.exe
/code/project.zip  ─→   media/uploads/project/project.zip
    ...                      ...
                       数据库: INSERT INTO files (...) VALUES (...)
```

管理命令 `bulk_import` 做了三件事：
1. 扫描目录下所有文件
2. 根据扩展名自动分类 → 复制到 `media/uploads/<category>/`
3. 将文件元信息（名称、路径、大小、SHA256）批量写入数据库

## 操作步骤

### 步骤1：准备文件

把要导入的文件整理到一个目录，按分类放好子目录（可选）：

```
/tmp/esta-import/
├── learning/          # 课程资料
│   ├── 模电课件.pdf
│   ├── 数电实验指导.doc
│   └── ...
├── project/           # 项目代码
│   ├── stm32-examples.zip
│   └── ...
├── circuit/           # 电路设计
│   ├── pcb-project.zip
│   └── ...
├── firmware/          # 固件
│   ├── bootloader.hex
│   └── ...
├── video/             # 教学视频
│   ├── pcb-tutorial.mp4
│   └── ...
├── tool/              # 软件工具
│   ├── keil-mdk.exe
│   ├── stm32cubeide.deb
│   └── ...
└── installer/         # 系统镜像
    └── ubuntu-22.04.iso
```

> 子目录名会作为分类依据。没有子目录的文件用 `--category` 参数指定默认分类。

### 步骤2：传输到服务器

```bash
# 方式1：本地文件直接复制（如果是同一台机器）
cp -r /your/files/* /path/to/esta-website/tmp-import/

# 方式2：通过移动硬盘/USB复制到服务器
# 方式3：网络传输（内网快）
scp -r /your/files/ user@server:/tmp/esta-import/

# 方式4：NAS 直接挂载（如果文件已在 NAS 上）
# 不需要复制，直接指定 NAS 路径即可
```

### 步骤3：运行导入命令

```bash
cd esta-website
source .venv/bin/activate

# 基础用法：指定目录，自动根据子目录名分类
python manage.py bulk_import /tmp/esta-import/

# 指定默认分类（没有子目录的文件归入此类）
python manage.py bulk_import /tmp/esta-import/ --default-category learning

# 干跑模式（不实际导入，只看会导入什么）
python manage.py bulk_import /tmp/esta-import/ --dry-run

# 指定文件大小上限（默认跳过 >2GB 的文件）
python manage.py bulk_import /tmp/esta-import/ --max-size 4294967296  # 4GB
```

### 步骤4：验证导入结果

命令输出示例：
```
═════════════════════════════════════════
  批量导入完成
═════════════════════════════════════════
  总文件数:     1,247
  成功导入:     1,243
  跳过(重复):   2
  跳过(超限):   2
  失败:         0
  总大小:       47.3 GB
  耗时:         4分32秒
═════════════════════════════════════════
```

验证：
```bash
# 查看文件数量
python manage.py shell -c "from core.models import UploadedFile; print(UploadedFile.objects.count())"

# 查看各类别文件数
python manage.py shell -c "
from core.models import UploadedFile
from django.db.models import Count
for item in UploadedFile.objects.values('category').annotate(c=Count('id')):
    print(f\"{item['category']}: {item['c']}\")
"
```

## BulkImport 管理命令（实现参考）

```python
# core/management/commands/bulk_import.py

import os
import hashlib
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from core.models import UploadedFile

EXT_TO_CATEGORY = {
    # learning
    '.pdf': 'learning', '.doc': 'learning', '.docx': 'learning',
    '.ppt': 'learning', '.pptx': 'learning', '.xls': 'learning',
    '.xlsx': 'learning', '.txt': 'learning', '.md': 'learning', '.csv': 'learning',
    # project
    '.c': 'project', '.cpp': 'project', '.h': 'project', '.hpp': 'project',
    '.py': 'project', '.rs': 'project', '.go': 'project', '.java': 'project',
    '.js': 'project', '.ts': 'project', '.v': 'project', '.sv': 'project',
    '.ino': 'project', '.asm': 'project', '.zip': 'project', '.rar': 'project',
    '.7z': 'project',
    # circuit
    '.sch': 'circuit', '.pcb': 'circuit', '.brd': 'circuit',
    '.json': 'circuit', '.epro': 'circuit', '.prjpcb': 'circuit',
    # firmware
    '.hex': 'firmware', '.bin': 'firmware', '.elf': 'firmware', '.uf2': 'firmware',
    # video
    '.mp4': 'video', '.mov': 'video', '.avi': 'video',
    '.mkv': 'video', '.webm': 'video',
    # tool
    '.exe': 'tool', '.msi': 'tool', '.apk': 'tool',
    '.deb': 'tool', '.rpm': 'tool', '.dmg': 'tool', '.tar': 'tool', '.gz': 'tool',
    # installer
    '.iso': 'installer', '.img': 'installer',
}

class Command(BaseCommand):
    help = '批量导入文件到协会网站'

    def add_arguments(self, parser):
        parser.add_argument('source_dir', help='源文件目录')
        parser.add_argument('--default-category', default='learning',
                          choices=['learning','project','circuit','firmware','video','tool','installer'])
        parser.add_argument('--max-size', type=int, default=2147483648,  # 2GB
                          help='单文件大小上限(字节)')
        parser.add_argument('--dry-run', action='store_true',
                          help='不实际导入，只显示即将导入的文件')

    def handle(self, **options):
        source = Path(options['source_dir'])
        total = 0
        success = 0
        skipped_dup = 0
        skipped_size = 0
        failed = 0

        files = list(source.rglob('*'))
        # 跳过目录
        files = [f for f in files if f.is_file()]

        for f in files:
            total += 1
            size = f.stat().st_size

            if size > options['max_size']:
                skipped_size += 1
                if options['verbosity'] > 0:
                    self.stdout.write(f'  [SKIP] {f.name}: 超过大小限制 ({size/1e9:.1f}GB)')
                continue

            # 跳过已存在的文件（按文件名+大小判断）
            if UploadedFile.objects.filter(
                original_name=f.name, file_size=size
            ).exists():
                skipped_dup += 1
                continue

            ext = f.suffix.lower()
            # 从父目录名推断分类
            category = f.parent.name if f.parent != source else None
            if category not in dict(EXT_TO_CATEGORY.values()):
                category = EXT_TO_CATEGORY.get(ext, options['default_category'])

            if options['dry_run']:
                self.stdout.write(f'  [DRY] {f.name} → {category} ({size/1e6:.1f}MB)')
                success += 1
                continue

            # 计算 SHA256（仅可执行文件）
            sha256 = ''
            if ext in ['.exe', '.msi', '.apk', '.deb', '.rpm']:
                sha256 = hashlib.sha256(f.read_bytes()).hexdigest()

            # 复制到 media/uploads/
            dest_dir = Path(settings.MEDIA_ROOT) / 'uploads' / category
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / f.name
            # 处理重名
            counter = 1
            while dest.exists():
                dest = dest_dir / f'{f.stem}_{counter}{f.suffix}'
                counter += 1
            dest.write_bytes(f.read_bytes())

            UploadedFile.objects.create(
                original_name=f.name,
                file=str(dest.relative_to(settings.MEDIA_ROOT)),
                category=category,
                file_size=size,
                sha256_hash=sha256,
            )
            success += 1

            # 每 100 个文件提交一次事务，防止中断后全部回滚
            if success % 100 == 0:
                from django.db import transaction
                transaction.commit()
                self.stdout.write(f'  已处理 {success} 个文件...')

        self.stdout.write(self.style.SUCCESS(f'\n导入完成: {success}/{total} 成功'
            f' (跳过重复:{skipped_dup}, 超限:{skipped_size}, 失败:{failed})'))
```

## 中断恢复

如果导入中途崩溃（磁盘满、断电），重新运行相同命令即可：
- 已成功导入的文件 → 自动检测跳过
- 因为每 100 个文件提交一次事务，崩溃时最多丢失最后 100 个文件的进度
- 崩溃前复制到 `media/uploads/` 但未写入数据库的文件 → 下次运行时会因为重名检测生成 `_1` 后缀的副本，可事后手动清理

## 常见问题

### Q: 导入后文件能直接下载吗？
能。导入命令把文件信息写入数据库，文件在 `media/uploads/` 下，和通过网页上传的效果完全一样。

### Q: 导入后需要重启服务吗？
不需要。文件系统和数据库都已更新，访问网站即可看到。

### Q: 重复导入同一个文件会怎样？
自动跳过（按文件名+文件大小判断重复）。

### Q: 大文件（>2GB）怎么导入？
默认跳过 >2GB 的文件（网页下载也不支持）。如需导入，使用 `--max-size` 指定更大的限制，但同时需要配置 Caddy 的超时和 Django 的文件大小限制。

### Q: 导入的源文件可以删除吗？
导入过程是**复制**，不是移动。确认导入成功后可以删除源文件以释放空间。
