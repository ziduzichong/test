# 电子科学与技术协会网站 — 测试指南

## 1. 快速启动（Windows）

```powershell
# 克隆
git clone <仓库地址> esta-website
cd esta-website

# 安装
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env

# 初始化（建表 + 管理员 + 示例数据）
python manage.py setup

# 启动
python manage.py runserver
```

浏览器打开 http://127.0.0.1:8000，管理员 **admin / admin123**。

> 如果 Django 没装：`E:\Anaconda\python.exe -m venv .venv` 指定 Anaconda Python 创建虚拟环境。

---

## 2. 功能总览

### 权限模型

| 角色 | 权限范围 |
|------|---------|
| 访客 | 首页、公告、成员、奖项、公开资料、搜索 |
| editor | 访客全部 + 上传/下载文件 + 编辑公告/成员/奖项/文件属性 |
| admin | editor 全部 + 删除文件（含批量）+ 创建账号 |

### 数据模块

| 模块 | 功能 | 公开/需登录 |
|------|------|------------|
| 公告 | 富文本（Quill），分类 news/course/exam，草稿→发布，支持图片嵌入 | 公开浏览 |
| 成员 | 名片展示，隐私控制（contact_public），排序 | 公开浏览 |
| 奖项 | 竞赛记录，等级标签，关联成员 | 公开浏览 |
| 文件 | 7 种分类（学习资料/项目代码/电路/固件/视频/工具/镜像），公开/私有开关，下载计数 | 登录浏览全部，访客仅公开 |
| 搜索 | 公告标题+内容 + 文件名称+描述 | 公告公开，文件需登录 |

### 文件分类与限制

| 分类 | 扩展名 | 大小上限 |
|------|--------|---------|
| learning | pdf, doc, docx, ppt, pptx, xls, xlsx, txt, md, csv | 100MB |
| project | c, cpp, h, py, rs, go, java, js, ts, zip, rar, 7z 等 | 100MB |
| circuit | sch, pcb, brd, json, epro, prjpcb | 100MB |
| firmware | hex, bin, elf, uf2 | 100MB |
| video | mp4, mov, avi, mkv, webm | 2GB |
| tool | exe, msi, apk, deb, rpm, tar, gz | 2GB |
| installer | iso, img | 2GB |

---

## 3. 功能测试清单

### 公开页面（无需登录）

- [ ] `/` 首页 — Hero 区 + 公告卡片 + 成员展示 + 奖项展示
- [ ] `/announcements/` 公告列表 — 分类筛选（全部/新闻/课程/考核）正常工作
- [ ] `/announcements/<id>/` 公告详情 — 富文本渲染正确，时间戳显示
- [ ] `/members/` 成员列表 — 3 列网格，头像首字 + 姓名 + 职位 + 技能标签
- [ ] `/members/<id>/` 成员详情 — 全部分信息，联系方式按 contact_public 控制
- [ ] `/awards/` 奖项列表 — 等级标签颜色不同（一等奖金/二等奖灰/三等奖橙）
- [ ] `/files/public/` 公开资料 — 仅显示 is_public=True 的文件，分类筛选，可下载
- [ ] `/search/?q=STM32` 搜索 — 公告和文件分区域展示，空结果友好提示

### 认证

- [ ] 错误密码登录 → 错误提示显示
- [ ] admin/admin123 登录 → 跳转 `/dashboard/`，导航栏显示"管理面板"+"退出"
- [ ] 退出 → 回到首页，导航栏恢复"登录"

### 管理面板

- [ ] 仪表盘统计数字与实际数据一致（文件数/公告数/成员数/下载量）
- [ ] 公告管理 — 新建（Quill 编辑器含图片上传）/ 编辑 / 发布↔下架 / 删除
- [ ] 成员管理 — 添加 / 编辑（含 contact_public 开关）/ 删除
- [ ] 奖项管理 — 添加（含等级选择 + 日期）/ 编辑 / 删除
- [ ] 文件管理 — 上传（拖拽/点击 + 分类选择 + 公开开关）/ 编辑属性 / 下载
- [ ] 文件删除 — 仅 admin 可见删除按钮，删除后行消失
- [ ] 批量删除 — 仅 admin，勾选 → 确认删除

### 权限验证

- [ ] 未登录访问 `/dashboard/` → 重定向到 `/login/`
- [ ] 创建 editor 账号 → 用 editor 登录 → 可上传/编辑，看不到删除按钮和账号管理
- [ ] editor 直接 POST `/api/files/1/delete/` → 403

### 异常场景

- [ ] 上传不支持的文件类型（如 .exe 选 learning 分类）→ 错误提示
- [ ] 上传时未选文件 → 错误提示"请选择文件"
- [ ] 上传可执行文件（.exe）→ SHA256 输入框自动出现

---

## 4. 稳定性与注意事项

- **开发服务器** `runserver` 仅用于本地测试，不可暴露到公网。生产部署用 Docker + Gunicorn（见 `docs/operations-manual.md`）
- **数据库** 为 SQLite 单文件 `data/db.sqlite3`，备份直接复制该文件（含 `-wal` 和 `-shm`）
- **上传文件** 存储在 `media/uploads/`，按年月分目录
- **重置数据库**：删除 `data/db.sqlite3` → `python manage.py setup`
- **静态文件** 修改 CSS/JS 后浏览器需 Ctrl+F5 强制刷新
- **端口冲突**：`python manage.py runserver 8080` 换端口

---

## 5. 常见问题

**Q: 启动报 ModuleNotFoundError: No module named 'django'**
虚拟环境没激活。执行 `.venv\Scripts\activate`。如果还没创建虚拟环境，先执行 `python -m venv .venv`。

**Q: python 命令默认是 Windows Store 的空白 Python**
用完整路径：`E:\Anaconda\python.exe` 替代 `python`，或用 `E:\Anaconda\python.exe -m venv .venv` 创建虚拟环境。

**Q: 页面样式错乱 / 按钮点击没反应**
F12 → Console 看是否有 JS 报错；Network 看是否所有 static/ 请求都是 200；Ctrl+F5 强制刷新清除缓存。

**Q: 上传文件卡住没反应**
确认文件大小未超限、扩展名在白名单内、文件已正确拖入上传区（应显示文件名和大小）。

**Q: 仪表盘数字显示 0**
运行 `python manage.py setup` 确保示例数据已写入。

**Q: 点击发布/下架/删除没反应**
F12 → Network → 看 POST 请求返回什么。403 是 CSRF token 问题（重启服务器），500 是后端错误（查看命令行的 Django traceback）。
