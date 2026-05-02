// 电子科学与技术协会网站 - Express 服务器
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { initTables, seedData, queryAll, queryOne, execute, lastInsertId } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// 数据目录
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'esta-website-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 12, sameSite: 'lax' }
}));
app.use(express.static(path.join(__dirname, 'public')));

// 登录速率限制
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  message: { ok: false, error: '登录尝试过于频繁，请1分钟后再试' }
});

// === 文件上传配置 ===
const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
  '.txt', '.html', '.css', '.js', '.json', '.xml',
  '.jpg', '.jpeg', '.png', '.gif', '.svg',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.c', '.cpp', '.h', '.hpp', '.py', '.v', '.sv',
  '.sch', '.pcb', '.brd', '.hex', '.bin', '.elf',
  '.md', '.csv', '.log'
];

const ALLOWED_MIMES = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/html', 'text/css', 'text/javascript',
  'application/javascript', 'application/json', 'application/xml',
  'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml',
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  'application/x-tar', 'application/gzip'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.body.category || 'learning';
    const dir = path.join(UPLOADS_DIR, category);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  }
});

// === 认证中间件 ===
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: '请先登录' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: '请先登录' });
  if (req.session.userRole !== 'admin') return res.status(403).json({ ok: false, error: '需要管理员权限' });
  next();
}

// === 认证 API ===
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ ok: false, error: '请输入用户名和密码' });
    const user = await queryOne("SELECT * FROM users WHERE username = ?", [username]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.json({ ok: false, error: '用户名或密码错误' });
    }
    req.session.userId = user.id;
    req.session.userRole = user.role;
    res.json({ ok: true, user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role } });
  } catch (e) {
    res.status(500).json({ ok: false, error: '登录失败' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/session', async (req, res) => {
  if (!req.session.userId) return res.json({ logged_in: false });
  try {
    const user = await queryOne("SELECT id, username, display_name, role FROM users WHERE id = ?", [req.session.userId]);
    if (!user) return res.json({ logged_in: false });
    res.json({ logged_in: true, user });
  } catch (e) {
    res.json({ logged_in: false });
  }
});

// === 公告 API ===
app.get('/api/announcements', async (req, res) => {
  try {
    const { category, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    let where = ''; const params = [];
    if (category) { where = ' WHERE category = ?'; params.push(category); }

    const totalRow = await queryOne(`SELECT COUNT(*) as cnt FROM announcements${where}`, params);
    const total = totalRow ? totalRow.cnt : 0;

    const rows = await queryAll(
      `SELECT * FROM announcements${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, (pageNum - 1) * limitNum]
    );
    res.json({ ok: true, data: { total, page: pageNum, limit: limitNum, announcements: rows } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/announcements', requireAuth, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    if (!title) return res.json({ ok: false, error: '标题不能为空' });
    await execute("INSERT INTO announcements (title, content, category) VALUES (?, ?, ?)", [title, content || '', category || 'news']);
    const id = await lastInsertId();
    res.json({ ok: true, data: { id } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put('/api/announcements/:id', requireAuth, async (req, res) => {
  try {
    const { title, content, category, is_published } = req.body;
    await execute(
      "UPDATE announcements SET title=?, content=?, category=?, is_published=?, updated_at=datetime('now','localtime') WHERE id=?",
      [title, content, category, is_published !== undefined ? is_published : 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/announcements/:id', requireAuth, async (req, res) => {
  try {
    await execute("DELETE FROM announcements WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// === 成员 API ===
app.get('/api/members', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const totalRow = await queryOne("SELECT COUNT(*) as cnt FROM members");
    const rows = await queryAll("SELECT * FROM members ORDER BY id LIMIT ? OFFSET ?", [limit, (page - 1) * limit]);
    res.json({ ok: true, data: { total: totalRow?.cnt || 0, page, limit, members: rows } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/members', requireAuth, async (req, res) => {
  try {
    const { name, position, avatar_url, bio, contact, skills, joined_at } = req.body;
    if (!name) return res.json({ ok: false, error: '姓名不能为空' });
    await execute("INSERT INTO members (name, position, avatar_url, bio, contact, skills, joined_at) VALUES (?,?,?,?,?,?,?)",
      [name, position || '', avatar_url || '', bio || '', contact || '', skills || '', joined_at || '']);
    const id = await lastInsertId();
    res.json({ ok: true, data: { id } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put('/api/members/:id', requireAuth, async (req, res) => {
  try {
    const { name, position, avatar_url, bio, contact, skills, joined_at } = req.body;
    await execute("UPDATE members SET name=?, position=?, avatar_url=?, bio=?, contact=?, skills=?, joined_at=? WHERE id=?",
      [name, position, avatar_url, bio, contact, skills, joined_at, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/members/:id', requireAuth, async (req, res) => {
  try {
    await execute("DELETE FROM members WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// === 文件 API ===
app.get('/api/files', requireAuth, async (req, res) => {
  try {
    const { category } = req.query;
    let sql = "SELECT * FROM files";
    const params = [];
    if (category) { sql += " WHERE category = ?"; params.push(category); }
    sql += " ORDER BY created_at DESC";
    const rows = await queryAll(sql, params);
    res.json({ ok: true, data: { files: rows } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/files/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json({ ok: false, error: '请选择文件' });
    const { category, description } = req.body;
    await execute(
      "INSERT INTO files (filename, original_name, file_path, category, description, uploader_id, file_size) VALUES (?,?,?,?,?,?,?)",
      [req.file.filename, req.file.originalname, req.file.path, category || 'learning', description || '', req.session.userId, req.file.size]
    );
    const id = await lastInsertId();
    res.json({ ok: true, data: { id } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/files/download/:id', requireAuth, async (req, res) => {
  try {
    const file = await queryOne("SELECT file_path, original_name FROM files WHERE id=?", [req.params.id]);
    if (!file) return res.status(404).json({ ok: false, error: '文件不存在' });
    if (!fs.existsSync(file.file_path)) return res.status(404).json({ ok: false, error: '文件已被删除' });
    res.download(file.file_path, file.original_name);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/files/:id', requireAuth, async (req, res) => {
  try {
    const file = await queryOne("SELECT file_path FROM files WHERE id=?", [req.params.id]);
    if (file && fs.existsSync(file.file_path)) fs.unlinkSync(file.file_path);
    await execute("DELETE FROM files WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// === 账号管理 API ===
app.get('/api/accounts', requireAdmin, async (req, res) => {
  try {
    const accounts = await queryAll("SELECT id, username, display_name, role, created_at FROM users ORDER BY id");
    res.json({ ok: true, data: { accounts } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/accounts', requireAdmin, async (req, res) => {
  try {
    const { username, password, display_name, role } = req.body;
    if (!username || !password) return res.json({ ok: false, error: '用户名和密码不能为空' });
    const exist = await queryOne("SELECT id FROM users WHERE username=?", [username]);
    if (exist) return res.json({ ok: false, error: '用户名已存在' });
    const hash = bcrypt.hashSync(password, 10);
    await execute("INSERT INTO users (username, password_hash, display_name, role) VALUES (?,?,?,?)",
      [username, hash, display_name || username, role || 'editor']);
    const id = await lastInsertId();
    res.json({ ok: true, data: { id } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 文件上传错误处理
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.json({ ok: false, error: err.code === 'LIMIT_FILE_SIZE' ? '文件大小超过50MB限制' : '文件上传失败: ' + err.message });
  }
  if (err) return res.json({ ok: false, error: err.message });
  next();
});

// === 启动 ===
(async () => {
  await initTables();
  await seedData();
  app.listen(PORT, () => {
    console.log(`[ESTA] 服务器已启动: http://localhost:${PORT}`);
    console.log(`[ESTA] 默认管理员: admin / admin123`);
  });
})();
