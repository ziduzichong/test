# 文件安全说明

## 为什么要做文件校验

协会网站允许上传可执行文件（exe、msi、apk 等），如果公网部署，恶意文件可能被上传后诱导他人下载执行。因此需要三层防护。

## 三层防护机制

### 第 1 层 — 扩展名白名单

```python
# files/validators.py

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
```

不在白名单的扩展名 → 拒绝上传。

### 第 2 层 — MIME 类型校验

Django 的 `FileField` 默认检查浏览器上报的 `Content-Type`。但这层可被伪造，所以不能仅靠它。

### 第 3 层 — 魔术字校验（关键防线）

使用 `python-magic` 读取文件头若干字节，比对真实文件类型：

```python
# files/validators.py

import magic

MAGIC_TO_CATEGORY = {
    'application/pdf':                          'learning',
    'application/msword':                       'learning',
    'application/vnd.openxmlformats...':         'learning',
    'text/plain':                               'learning',
    'video/mp4':                                'video',
    'video/x-matroska':                         'video',
    'application/x-dosexec':                    'tool',      # PE 可执行文件
    'application/x-msdownload':                 'tool',
    'application/zip':                          'project',   # zip 可能是代码压缩包
    'application/x-tar':                        'tool',
    # ... 完整映射见源码
}

def validate_file_type(uploaded_file, claimed_category):
    """读取文件头魔术字，与声称的分类校验"""
    # 读取文件头 256 字节
    file_header = uploaded_file.read(256)
    uploaded_file.seek(0)  # 重置指针

    mime = magic.from_buffer(file_header, mime=True)
    expected_category = MAGIC_TO_CATEGORY.get(mime)

    if expected_category is None:
        raise ValidationError(f"无法识别的文件类型: {mime}")

    if expected_category != claimed_category:
        raise ValidationError(
            f"文件真实类型为 {mime}（{expected_category}），"
            f"与你选择的分类 {claimed_category} 不匹配。"
            f"这可能是一个伪装了扩展名的文件。"
        )
```

**例子**：`virus.exe` 改名为 `notes.pdf` 上传。魔术字 `0x4D5A`（PE 可执行文件头）暴露其真实类型为 `application/x-dosexec`，与声称的 `learning` 分类不匹配 → 拒绝。

## 可执行文件额外要求

上传 `exe, msi, apk, deb, rpm` 等可执行文件时：

1. **强制填写 SHA256 校验值** — 方便下载者验证文件完整性
2. **下载页展示校验值** — 用户可对比 `sha256sum` 输出
3. **仅管理员可删除** — 普通用户不可删除或覆盖

```python
# files/models.py 中的校验
from django.core.validators import RegexValidator

class UploadedFile(models.Model):
    ...
    sha256_hash = models.CharField(
        max_length=64,
        validators=[RegexValidator(r'^[a-f0-9]{64}$', 'SHA256 必须为 64 位十六进制字符串')],
        blank=True,
        help_text='可执行文件必须填写'
    )

    def clean(self):
        executable_exts = ['.exe', '.msi', '.apk', '.deb', '.rpm']
        ext = os.path.splitext(self.original_name)[1].lower()
        if ext in executable_exts and not self.sha256_hash:
            raise ValidationError('可执行文件必须提供 SHA256 校验值')
```

## 下载鉴权

### 问题

若 Caddy/Nginx 直接服务 `/media/` 路径，用户可通过 `https://example.com/media/uploads/secret.doc` 直接下载，绕过 Django 的登录检查。

### 解决

使用反向代理的 `internal` 路由机制：

**Caddyfile**：
```caddy
# 禁止外部直接访问
handle /protected/* {
    internal
}

# 所有请求先走 Django
handle {
    reverse_proxy app:8000
}
```

**Django 视图**：
```python
@login_required
def download_file(request, file_id):
    obj = UploadedFile.objects.get(id=file_id)
    response = HttpResponse()
    # Caddy 识别此头，从 /protected/ 路径返回文件
    response["X-Accel-Redirect"] = f"/protected/{obj.file.name}"
    response["Content-Disposition"] = f'attachment; filename="{obj.original_name}"'
    obj.download_count += 1
    obj.save()
    return response
```

## 安全提醒

下载页对可执行文件展示提醒：

> ⚠️ 此文件为可执行程序。请下载后验证 SHA256 校验值，确认与页面显示一致后再运行。SHA256: `a1b2c3d4...`

## 总结

| 防护层 | 阻止什么 | 实现 |
|--------|---------|------|
| 扩展名白名单 | 无关文件类型 | `validators.py` |
| MIME 校验 | 浏览器谎报 | Django FileField |
| 魔术字校验 | 扩展名伪装 | `python-magic` |
| 下载鉴权 | 未登录直链下载 | Caddy internal + X-Accel-Redirect |
| SHA256 校验 | 文件被篡改 | 上传时强制填写，下载时展示 |
