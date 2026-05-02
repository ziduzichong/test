// 数据库模块 - 基于 sql.js (SQLite WASM)
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'esta.db');

let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// 参数化查询辅助函数 - 返回结果数组
async function queryAll(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// 参数化查询辅助函数 - 返回单行
async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows[0] || null;
}

// 执行语句 (INSERT/UPDATE/DELETE)
async function execute(sql, params = []) {
  const db = await getDb();
  db.run(sql, params);
  saveDb();
}

// 获取最后插入的ID
async function lastInsertId() {
  const db = await getDb();
  const result = db.exec("SELECT last_insert_rowid() as id");
  return result[0]?.values[0]?.[0] || null;
}

async function initTables() {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
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
  db.run(`
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
  db.run(`
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
  saveDb();
}

async function seedData() {
  const db = await getDb();
  const bcrypt = require('bcryptjs');

  // 种子管理员账号
  const adminCount = db.exec("SELECT COUNT(*) as c FROM users WHERE username = 'admin'");
  if (adminCount[0]?.values[0]?.[0] === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run("INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
      ['admin', hash, '管理员', 'admin']);
  }

  // 种子示例公告
  const annCount = db.exec("SELECT COUNT(*) as c FROM announcements");
  if (annCount[0]?.values[0]?.[0] === 0) {
    db.run("INSERT INTO announcements (title, content, category) VALUES (?, ?, ?)",
      ['欢迎访问电子科学与技术协会', '<p>电子科学与技术协会致力于为同学们提供电子技术学习与交流的平台。欢迎新同学加入我们！</p>', 'news']);
    db.run("INSERT INTO announcements (title, content, category) VALUES (?, ?, ?)",
      ['2026春季课程安排', '<p>本学期将开设以下课程：<br>1. 单片机基础（STM32）<br>2. PCB设计与制作<br>3. 模拟电路实践</p>', 'course']);
  }

  // 种子示例成员
  const memCount = db.exec("SELECT COUNT(*) as c FROM members");
  if (memCount[0]?.values[0]?.[0] === 0) {
    db.run("INSERT INTO members (name, position, bio, contact, skills, joined_at) VALUES (?, ?, ?, ?, ?, ?)",
      ['张三', '会长', '电子科学与技术专业大三学生，负责协会整体运营。', 'zhangsan@example.com', 'STM32, PCB设计, 嵌入式开发', '2024-09']);
    db.run("INSERT INTO members (name, position, bio, contact, skills, joined_at) VALUES (?, ?, ?, ?, ?, ?)",
      ['李四', '技术部长', '擅长模拟电路和FPGA开发，曾获全国电子设计竞赛一等奖。', 'lisi@example.com', 'FPGA, 模拟电路, Verilog', '2024-09']);
  }

  saveDb();
}

module.exports = { getDb, saveDb, initTables, seedData, queryAll, queryOne, execute, lastInsertId };
