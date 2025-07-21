# Sasovo Cloudflare Workers 图床

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

1. **准备 Telegram Bot**
   - 创建 Bot 并获取 Token，获取你的 Chat ID

2. **配置环境变量**
   - 在 wrangler.json 中配置 `TG_BOT_TOKEN`、`TG_CHAT_ID`，可选 `SHORTLINK_DOMAIN`

3. **初始化数据库**
   - 执行 schema.sql 创建/升级 images 表：
     ```sql
     -- images 表升级
     ALTER TABLE images ADD COLUMN tags TEXT;
     ALTER TABLE images ADD COLUMN filename TEXT;
     ALTER TABLE images ADD COLUMN size INTEGER;
     ALTER TABLE images ADD COLUMN visit_count INTEGER DEFAULT 0;
     ```

4. **部署到 Cloudflare Workers**
   - 推荐 wrangler.json 配置：
     ```json
     {
       "name": "cf-workers-telegram-image",
       "main": "./src/worker/index.ts",
       "compatibility_date": "2025-04-01",
       "d1_databases": [
         { "binding": "DB", "database_name": "telegram_image_db", "database_id": "xxxx" }
       ]
     }
     ```
   - `pnpm install && pnpm run build && pnpm run deploy`

5. **访问你的域名**
   - 默认首页即为现代美观的图片上传与管理界面

---

## ⚙️ 环境变量说明

- `TG_BOT_TOKEN`：Telegram Bot Token
- `TG_CHAT_ID`：图片发送目标 Chat ID
- `SHORTLINK_DOMAIN`：自定义短链域名（如 img.sasovo.top，可选）

---

## 🗄️ 数据库升级说明

如遇 `no such column` 或 `no such table` 报错，请在 D1 控制台依次执行：

```sql
ALTER TABLE images ADD COLUMN tags TEXT;
ALTER TABLE images ADD COLUMN filename TEXT;
ALTER TABLE images ADD COLUMN size INTEGER;
ALTER TABLE images ADD COLUMN visit_count INTEGER DEFAULT 0;
```

---

## 💡 常见问题

- **图片直链无法访问？**
  - 检查 wrangler.json 不要配置 assets，所有路由交给 Worker 处理
- **数据库表结构不对？**
  - 参考上方“数据库升级说明”手动执行 SQL
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
