# API 文档

## 认证说明

- 所有需要登录的接口，必须在请求头加上：  
  `Authorization: Bearer <JWT_TOKEN>`
- JWT_TOKEN 通过 `/api/login` 登录接口获取，7天过期，活跃期间自动续期。

---

## 1. 登录

- **接口**：`POST /api/login`
- **请求体**（JSON）：
  ```json
  {
    "username": "your_admin_user",
    "password": "your_admin_pass"
  }
  ```
- **返回**：
  ```json
  {
    "status": "success",
    "token": "<JWT_TOKEN>"
  }
  ```
  失败时：
  ```json
  {
    "status": "error",
    "message": "用户名或密码错误"
  }
  ```

---

## 2. 登出

- **接口**：`POST /api/logout`
- **请求头**：`Authorization: Bearer <JWT_TOKEN>`
- **返回**：
  ```json
  { "status": "success" }
  ```

---

## 3. 获取系统设置

- **接口**：`GET /api/settings`
- **请求头**：`Authorization: Bearer <JWT_TOKEN>`
- **返回**：
  ```json
  {
    "status": "success",
    "domain": "...",
    "chat_id": "...",
    "total": 123,
    "size": 12345678
  }
  ```

---

## 4. 上传图片

- **接口**：`POST /api/upload`
- **请求头**：`Authorization: Bearer <JWT_TOKEN>`
- **请求体**：`FormData`
  - `photo`：图片文件
  - `expire`：有效期（如 `forever`、`1`、`7`、`30`，单位天）
  - `tags`：标签（逗号分隔）
  - `filename`：文件名
- **说明**：上传后会保存原图 file_id 和缩略图 thumb_file_id。
- **返回**：
  ```json
  { "status": "success", "short_code": "...", "short_url": "...", ... }
  ```

---

## 5. 获取图片

- **接口**：`GET /api/history`
- **请求头**：`Authorization: Bearer <JWT_TOKEN>`
- **参数**（Query）：
  - `search`：搜索关键字（可选）
  - `tag`：标签（可选）
  - `filename`：文件名（可选）
  - `page`：页码（默认1）
  - `limit`：每页数量（默认50）
- **返回**：
  ```json
  {
    "status": "success",
    "data": [ ... ],
    "page": 1,
    "limit": 50,
    "total": 100
  }
  ```

---

## 6. 获取图片内容

- **接口**：`GET /api/get_photo/{file_id}`
- **请求头**：`Authorization: Bearer <JWT_TOKEN>`
- **参数**：
  - `thumb=1`（可选，获取缩略图，使用 thumb_file_id）
- **返回**：图片二进制流
- **说明**：file_id 为原图，thumb=1 时返回缩略图。

---

## 7. 删除图片

- **接口**：`POST /api/delete`
- **请求头**：`Authorization: Bearer <JWT_TOKEN>`
- **请求体**（JSON）：
  ```json
  { "ids": ["file_id1", "file_id2", ...] }
  ```
- **返回**：
  ```json
  { "status": "success" }
  ```

---

## 8. 获取统计

- **接口**：`GET /api/stats`
- **请求头**：`Authorization: Bearer <JWT_TOKEN>`
- **返回**：
  ```json
  { "total": 123, "size": 12345678 }
  ```

---

## 9. 去重

- **接口**：`POST /api/deduplicate`
- **请求头**：`Authorization: Bearer <JWT_TOKEN>`
- **返回**：
  ```json
  { "status": "success", "deleted": 3, "duplicates": [ ... ] }
  ```

---

## 10. 短链直链访问

- **接口**：`GET /img/{short_code}`
- **返回**：图片二进制流（无需登录）

---

## 11. 移动图片

- **接口**：`POST /api/move_images`
- **请求头**：`Authorization: Bearer <JWT_TOKEN>`
- **请求体**（JSON）：
  ```json
  { "ids": ["file_id1", "file_id2", ...], "target_folder": "/目标/文件夹/" }
  ```
- **返回**：
  ```json
  { "status": "success" }
  ```

---

## 12. 复制图片

- **接口**：`POST /api/copy_images`
- **请求头**：`Authorization: Bearer <JWT_TOKEN>`
- **请求体**（JSON）：
  ```json
  { "ids": ["file_id1", "file_id2", ...], "target_folder": "/目标/文件夹/" }
  ```
- **返回**：
  ```json
  { "status": "success" }
  ```

---

## 文件夹与面包屑导航

- 文件夹路径仅允许中英文、数字、下划线，支持多级（如 `/图库/二次元/`）。
- 图库页顶部显示面包屑导航，点击任意一级可跳转。
- 文件夹管理支持增删改查，删除文件夹会递归删除所有子文件夹和图片。

## 其它说明

- 所有返回均为 JSON，除图片流接口外。
- 认证失败时返回 401。
- token 续期：如响应头有 `X-Refreshed-Token`，前端应自动替换本地 token。
- 数据库 images 表结构包含 file_id、thumb_file_id 字段。 