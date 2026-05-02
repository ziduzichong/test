# 代码审查修改任务表

| # | 文件 | 行号 | 问题描述 | 严重程度 | 修改方案 | 状态 |
|---|------|------|---------|---------|---------|------|
| 1 | server.js | 140 | parseInt(page) 在 page 为非数字时返回 NaN，导致 SQL 参数异常 | 一般 | 使用 parseInt(page, 10) || 1 提供安全默认值 | ✅ 已修复 |
| 2 | public/js/app.js | 161 | 文件下载链接硬编码为 /api/files/download/，无统一 base 路径 | 建议 | 使用 App.api.base 拼接 | 不采纳（API base 固定为 /api，硬编码更清晰） |
| 3 | server.js | — | middleware/ 目录为空，auth 中间件内联在 server.js 中 | 建议 | 按计划拆分到 middleware/auth.js | 不采纳（server.js 330行低于拆分阈值，内联更简洁） |
