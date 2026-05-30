const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'esta.db');

let db = null;

function getDb() {
  if (db) return db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode=WAL');
  db.exec('PRAGMA busy_timeout=5000');
  return db;
}

function queryAll(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  return stmt.all(...params);
}

function queryOne(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  return stmt.get(...params) || null;
}

function execute(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  return stmt.run(...params);
}

function lastInsertId() {
  const d = getDb();
  const row = d.prepare('SELECT last_insert_rowid() as id').get();
  return Number(row.id);
}

function initTables() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'news',
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      skills TEXT NOT NULL DEFAULT '',
      joined_at TEXT NOT NULL DEFAULT ''
    )
  `);
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'learning',
      description TEXT NOT NULL DEFAULT '',
      uploader_id INTEGER,
      file_size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
}

function seedData() {
  const bcrypt = require('bcryptjs');
  const d = getDb();

  const adminExists = d.prepare("SELECT COUNT(*) as c FROM users WHERE username = ?").get('admin');
  if (adminExists.c === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    d.prepare("INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)")
      .run('admin', hash, '管理员', 'admin');
  }

  const annCount = d.prepare("SELECT COUNT(*) as c FROM announcements").get();
  if (annCount.c === 0) {
    d.prepare("INSERT INTO announcements (title, content, category) VALUES (?, ?, ?)")
      .run('欢迎访问电子科学与技术协会', '<p>电子科学与技术协会致力于为同学们提供电子技术学习与交流的平台。欢迎新同学加入我们！</p>', 'news');
    d.prepare("INSERT INTO announcements (title, content, category) VALUES (?, ?, ?)")
      .run('2026春季课程安排', '<p>本学期将开设以下课程：<br>1. 单片机基础（STM32）<br>2. PCB设计与制作<br>3. 模拟电路实践</p>', 'course');
  }

  const memCount = d.prepare("SELECT COUNT(*) as c FROM members").get();
  if (memCount.c === 0) {
    d.prepare("INSERT INTO members (name, position, bio, contact, skills, joined_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run('张三', '会长', '电子科学与技术专业大三学生，负责协会整体运营。', 'zhangsan@example.com', 'STM32, PCB设计, 嵌入式开发', '2024-09');
    d.prepare("INSERT INTO members (name, position, bio, contact, skills, joined_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run('李四', '技术部长', '擅长模拟电路和FPGA开发，曾获全国电子设计竞赛一等奖。', 'lisi@example.com', 'FPGA, 模拟电路, Verilog', '2024-09');
  }
}

module.exports = { getDb, initTables, seedData, queryAll, queryOne, execute, lastInsertId };
