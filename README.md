<h1 align="center">Sasovo Cloudflare Workers 图床</h1>

> 基于 Cloudflare Workers + Telegram Bot 的免费图片直链/图床系统，支持多文件上传、批量管理、标签分类、现代美观 UI。
[感谢原项目,根据此项目修改而来](https://github.com/houhoz/cf-workers-telegram-image)

![screenshot](./preview.png)

---

## ✨ 主要特性

- **多文件上传**：支持批量、拖拽、粘贴、压缩上传
- **永久直链**：图片直链可用于 Markdown/HTML/外链
- **标签分类**：支持标签管理与筛选
- **批量操作**：批量删除、导出历史记录
- **现代 UI**：深色主题、卡片风格、响应式设计
- **Cloudflare D1**：数据安全、全球加速、免费额度
- **自定义页面标题/网站图标**：支持在设置页自定义网站标题和 favicon

---

## 🚀 快速开始
准备工作
   - 创建 Bot 并获取 Token，并通过@getidbot获取你的 Chat ID

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button?projectName=cf-workers-telegram-image)](https://deploy.workers.cloudflare.com/?url=https://github.com/pasovo/cf-workers-telegram-image)

1. **一键部署**
   - 点击上方按钮，登录 Cloudflare 账号，自动 fork 并部署本项目。

2. **配置环境变量**
   - 在 Cloudflare 控制台「设置」-「变量与机密」中，配置以下环境变量：
     - `TG_BOT_TOKEN`：Telegram Bot Token
     - `TG_CHAT_ID`：图片发送目标 Chat ID
     - `ADMIN_USER`：登录用户名
     - `ADMIN_PASS`：登录密码
     - `SHORTLINK_DOMAIN`：自定义短链域名（可选）--域名其实写了自动获取，你用什么域名访问就会用什么域名显示直链，但不保证有人有需求所以就保留了

3. **初始化数据库**
   - 首次部署后，请在 Cloudflare D1 控制台执行以下 SQL 以初始化表结构：
     ```sql
     CREATE TABLE IF NOT EXISTS images (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       file_id TEXT NOT NULL,
       chat_id TEXT NOT NULL,
       short_code TEXT UNIQUE NOT NULL,
       expire_at TIMESTAMP,
       tags TEXT,
       filename TEXT,
       size INTEGER,
       visit_count INTEGER DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     );
     ```

4. **访问你的域名!开始吧**

---

## 💡 常见问题

- **图片直链无法访问？**
  - 检查 wrangler.json 不要配置 assets，所有路由交给 Worker 处理
- **如何自定义页面标题/网站图标？**
  - 进入“设置”页面，输入标题或上传 favicon 并保存即可，支持本地持久化

---

## 🙏 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Tailwind CSS](https://tailwindcss.com/)
- [Hono](https://hono.dev/)

---

> MIT License | By Sasovo
