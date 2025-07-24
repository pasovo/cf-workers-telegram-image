import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { sign, verify } from 'hono/jwt';

type Bindings = {
  TG_BOT_TOKEN: string;
  TG_CHAT_ID: string;
  DB: D1Database; // 添加D1数据库类型
  ADMIN_USER: string;
  ADMIN_PASS: string;
  JWT_SECRET: string; // 新增JWT密钥
};

const app = new Hono<{ Bindings: Bindings }>();

// 工具函数：过滤文件名非法字符
function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// 工具函数：生成唯一短码
function genShortCode(length = 7) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 工具函数：校验文件夹名
function isValidFolderName(name: string) {
  return /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name);
}

// 获取域名配置
function getBaseUrl(env: any, req: any) {
  // 优先用环境变量 SHORTLINK_DOMAIN，否则用请求头
  const host = req.header('x-forwarded-host');
  const proto = req.header('x-forwarded-proto') || 'https';
  return env.SHORTLINK_DOMAIN || (host ? `${proto}://${host}` : '');
}

// 上传图片处理，支持 folder 字段
app.post('/api/upload', async (c) => {
  const { TG_BOT_TOKEN, TG_CHAT_ID, DB } = c.env;
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
      return c.json({
          status: 'error',
          message: '环境变量配置不完整',
          details: 'TG_BOT_TOKEN 和 TG_CHAT_ID 必须配置'
      }, { status: 500 });
  }
  const formData = await c.req.formData();
  const photoFile = formData.get('photo') as File;
  if (!photoFile || photoFile.size === 0) {
      return c.json({
          status: 'error',
          message: '请上传有效的图片文件'
      }, { status: 400 });
  }
  formData.append('chat_id', TG_CHAT_ID);
  // 有效期参数
  const expireOption = formData.get('expire') as string || 'forever';
  let expire_at: string | null = null;
  if (expireOption === '1') expire_at = new Date(Date.now() + 86400 * 1000).toISOString();
  if (expireOption === '7') expire_at = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  if (expireOption === '30') expire_at = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
  // 标签和文件名
  const tags = (formData.get('tags') as string || '').trim();
  let filename = (formData.get('filename') as string || '').trim();
  if (filename) filename = sanitizeFilename(filename);
  let folder = (formData.get('folder') as string || '/').trim();
  if (!folder.startsWith('/')) folder = '/' + folder;
  if (!folder.endsWith('/')) folder += '/';
  // 校验每一级文件夹名
  const parts = folder.split('/').filter(Boolean);
  for (const part of parts) {
    if (!isValidFolderName(part)) {
      return c.json({ status: 'error', message: '文件夹名仅允许中英文、数字、下划线' }, { status: 400 });
    }
  }
  // 上传到 Telegram
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`,
      { method: 'POST', body: formData }
    );
    if (!response.ok) {
      const errorDetails = await response.text();
      let errorMsg = 'Telegram API调用失败';
      try {
        const errorJson = JSON.parse(errorDetails);
        if (errorJson && typeof errorJson === 'object') {
          if (errorJson.description) errorMsg += `: ${errorJson.description}`;
          console.error(`Telegram API错误: status_code=${response.status}, description=${errorJson.description || ''}`);
        } else {
          console.error(`Telegram API错误: status_code=${response.status}, body=${errorDetails}`);
        }
      } catch {
        console.error(`Telegram API错误: status_code=${response.status}, body=${errorDetails}`);
      }
      return c.json({
        status: 'error',
        message: errorMsg,
        details: errorDetails,
        status_code: response.status
      }, { status: 500 });
    }
    const res: {
      ok: boolean;
      result?: { photo?: Array<{ file_id: string }> };
      description?: string;
    } = await response.json();
    if (res.ok && res.result?.photo && res.result.photo.length > 0) {
      const photo = res.result.photo;
      const file_id = String(photo[photo.length - 1]?.file_id || ''); // 原图
      const thumb_file_id = String(photo[0]?.file_id || ''); // 最小缩略图
      // 生成唯一短码
      let short_code = '';
      let tryCount = 0;
      while (true) {
        short_code = genShortCode();
        const check = await DB.prepare('SELECT 1 FROM images WHERE short_code = ?').bind(short_code).first();
        if (!check) break;
        tryCount++;
        if (tryCount > 5) throw new Error('短码生成失败，请重试');
      }
      // 保存记录到数据库（增加folder字段）
      try {
        const size = photoFile.size;
        const contentType = photoFile.type || 'image/jpeg';
        const stmt = DB.prepare(
          'INSERT INTO images (file_id, thumb_file_id, chat_id, short_code, expire_at, tags, filename, size, folder, content_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)' 
        );
        const dbResult = await stmt.bind(file_id, thumb_file_id, TG_CHAT_ID, short_code, expire_at, tags, filename, size, folder, contentType).run();
        if (!dbResult.success) {
            throw new Error(`数据库插入失败: ${JSON.stringify(dbResult.error)}`);
        }
        // 删除上传、访问等日志写入
      } catch (dbError) {
        console.error('数据库插入错误:', dbError);
        return c.json({
            status: 'error',
            message: '保存记录失败',
            details: dbError instanceof Error ? dbError.message : String(dbError)
        }, { status: 500 });
      }
      // 返回短链
      const baseUrl = getBaseUrl(c.env, c.req);
      const shortUrl = baseUrl ? `${baseUrl}/img/${short_code}` : `/img/${short_code}`;
      return c.json({ status: 'success', phonos: photo, short_code, short_url: shortUrl, expire_at });
    } else {
      return c.json({ status: 'error', message: res.description || '上传失败' });
    }
  } catch (error: unknown) {
    // 检查 Cloudflare Worker 超时报错
    let isCpuTimeout = false;
    let errorMsg = '服务器错误';
    if (error && typeof error === 'object') {
      const msg = (error as any).message || '';
      if (msg.includes('Worker exceeded CPU time limit')) {
        isCpuTimeout = true;
        errorMsg = 'Cloudflare Worker 执行超时，请稍后重试或优化图片大小。';
      }
    }
    if (!isCpuTimeout && typeof error === 'string' && error.includes('Worker exceeded CPU time limit')) {
      isCpuTimeout = true;
      errorMsg = 'Cloudflare Worker 执行超时，请稍后重试或优化图片大小。';
    }
    if (isCpuTimeout) {
      return c.json({ status: 'error', message: errorMsg }, { status: 504 });
    }
    console.error(error);
    return c.json({ status: 'error', message: '服务器错误' }, { status: 500 });
  }
});
// /api/get_photo/:file_id 支持缩略图
app.get('/api/get_photo/:file_id', async (c) => {
  const { TG_BOT_TOKEN, DB } = c.env;
  let file_id = c.req.param('file_id');
  const isThumb = c.req.query('thumb') === '1';
  // 查找file_id和thumb_file_id和content_type
  const row = await DB.prepare('SELECT file_id, thumb_file_id, content_type FROM images WHERE file_id = ? OR thumb_file_id = ?').bind(file_id, file_id).first();
  if (!row) {
    return c.json({ status: 'error', message: '图片不存在' }, { status: 404 });
  }
  if (isThumb && row.thumb_file_id) {
    file_id = String(row.thumb_file_id);
  } else {
    file_id = String(row.file_id);
  }
  // 获取 file_path
  const getFileResponse = await fetch(
    `https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${file_id}`
  );
  const getFileRes: any = await getFileResponse.json();
  if (getFileRes.ok) {
    const file_path = getFileRes.result.file_path;
    const imageResponse = await fetch(
      `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${file_path}`
    );
    const imageRes = await imageResponse.arrayBuffer();
    const contentType = typeof row.content_type === 'string' ? row.content_type : 'image/jpeg';
    return new Response(imageRes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000'
      },
    });
  } else {
    return c.json({ status: 'error', message: '获取文件失败' });
  }
});
// 批量删除接口（加事务）
app.post('/api/delete', async (c) => {
  const { DB } = c.env;
  const { ids } = await c.req.json(); // ids: file_id[]
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ status: 'error', message: '参数错误' }, { status: 400 });
  }
  try {
    // 用 D1 batch API 批量删除
    const stmts = ids.map(id => DB.prepare('DELETE FROM images WHERE file_id = ?').bind(id));
    await DB.batch(stmts);
    return c.json({ status: 'success' });
  } catch (error) {
    return c.json({ status: 'error', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
// /img/:short_code 直链访问，计数+日志
app.get('/img/:short_code', async (c) => {
  const { short_code } = c.req.param();
  const { DB } = c.env;
  // 查找短码
  const row = await DB.prepare('SELECT file_id, expire_at, content_type FROM images WHERE short_code = ?').bind(short_code).first();
  if (!row) {
    return c.text('链接不存在', 404);
  }
  if (row.expire_at && new Date(String(row.expire_at)).getTime() < Date.now()) {
    return c.text('链接已过期', 410);
  }
  // 返回原图
  const TG_BOT_TOKEN = c.env.TG_BOT_TOKEN;
  const getFileResponse = await fetch(
    `https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${row.file_id}`
  );
  const getFileRes: any = await getFileResponse.json();
  if (getFileRes.ok) {
    const file_path = getFileRes.result.file_path;
    const imageResponse = await fetch(
      `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${file_path}`
    );
    const imageRes = await imageResponse.arrayBuffer();
    const contentType = typeof row.content_type === 'string' ? row.content_type : 'image/jpeg';
    return new Response(imageRes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000'
      },
    });
  } else {
    return c.text('图片获取失败', 404);
  }
});

// 获取图片API，支持 folder 参数，返回当前文件夹下图片和子文件夹
app.get('/api/history', async (c) => {
  try {
    const { page = '1', limit = '50', search = '', tag = '', filename = '', folder = '/' } = c.req.query();
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const offset = (pageNum - 1) * limitNum;
    let sql = 'SELECT * FROM images WHERE 1=1';
    const params: any[] = [];
    if (search) {
      sql += ' AND (file_id LIKE ? OR chat_id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (tag) {
      sql += ' AND tags LIKE ?';
      params.push(`%${tag}%`);
    }
    if (filename) {
      sql += ' AND filename LIKE ?';
      params.push(`%${filename}%`);
    }
    if (folder) {
      sql += ' AND folder = ?';
      params.push(folder);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);
    const { results } = await c.env.DB.prepare(sql).bind(...params).all();
    // 获取当前文件夹下的所有子文件夹
    const folderSql = 'SELECT DISTINCT folder FROM images WHERE folder LIKE ?';
    const folderLike = folder === '/' ? '/%' : folder + '%';
    const allFolders = await c.env.DB.prepare(folderSql).bind(folderLike).all();
    // 只保留当前层级的子文件夹
    const subFolders = Array.from(new Set(
      allFolders.results
        .map((row: any) => row.folder)
        .filter((f: string) => f.startsWith(folder) && f !== folder)
        .map((f: string) => {
          const rest = f.slice(folder.length);
          return rest.split('/')[0];
        })
        .filter(Boolean)
    ));
    // 查询总数
    const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as n FROM images WHERE folder = ?').bind(folder).first();
    return c.json({
      status: 'success',
      data: results,
      folders: subFolders,
      page: pageNum,
      limit: limitNum,
      total: totalRow?.n || 0
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : '获取图片失败'
    }, { status: 500 });
  }
});

// 统计API
app.get('/api/stats', async (c) => {
  const { DB } = c.env;
  const total = await DB.prepare('SELECT COUNT(*) as n, COALESCE(SUM(size),0) as size FROM images').first();
  return c.json({
    status: 'success',
    total: total?.n || 0,
    size: total?.size || 0
  });
});
// 设置API
app.get('/api/settings', async (c) => {
  // 鉴权
  const token = getJwtToken(c);
  if (!token) {
    return c.json({ status: 'error', message: '未登录' }, { status: 401 });
  }
  const DB = c.env.DB;
  const SHORTLINK_DOMAIN = (c.env as any).SHORTLINK_DOMAIN;
  const TG_CHAT_ID = c.env.TG_CHAT_ID;
  const total = await DB.prepare('SELECT COUNT(*) as n, COALESCE(SUM(size),0) as size FROM images').first();
  return c.json({
    status: 'success',
    domain: SHORTLINK_DOMAIN || '',
    chat_id: TG_CHAT_ID || '',
    total: total?.n || 0,
    size: total?.size || 0
  });
});

app.get('/api/test-db', async (c) => {
  try {
    // 执行SQL查询
    const result = await c.env.DB.prepare('SELECT 1 + 1 AS sum').first();
    return c.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : '\u6570\u636e\u5e93\u64cd\u4f5c\u5931\u8d25'
    }, { status: 500 });
  }
});

// 3. 定期去重 API（仅管理员可用），保留最后一条
app.post('/api/deduplicate', async (c) => {
  // 简单鉴权
  const token = getJwtToken(c);
  if (!token) {
    return c.json({ status: 'error', message: '未登录' }, { status: 401 });
  }
  const DB = c.env.DB;
  // 查找重复 hash
  const { results } = await DB.prepare('SELECT hash, COUNT(*) as n FROM images WHERE hash IS NOT NULL GROUP BY hash HAVING n > 1').all();
  let deleted = 0;
  const duplicates: any[] = [];
  for (const row of results) {
    // 保留最后一条，其余删除
    const dups = await DB.prepare('SELECT * FROM images WHERE hash = ? ORDER BY created_at ASC').bind(row.hash).all();
    const toDelete = dups.results.slice(0, -1); // 保留最后一条
    const toKeep = dups.results[dups.results.length - 1];
    for (const img of toDelete) {
      await DB.prepare('DELETE FROM images WHERE id = ?').bind(img.id).run();
      deleted++;
    }
    if (toDelete.length > 0) {
      duplicates.push({ hash: row.hash, keep: toKeep, deleted: toDelete });
    }
  }
  return c.json({ status: 'success', deleted, duplicates });
});

// 文件夹增删改查接口
app.get('/api/folders', async (c) => {
  // 获取所有文件夹路径
  const { DB } = c.env;
  const all = await DB.prepare('SELECT DISTINCT folder FROM images').all();
  return c.json({ status: 'success', folders: all.results.map((r: any) => r.folder) });
});
app.post('/api/folders', async (c) => {
  // 新建文件夹（仅逻辑，实际只需前端传递folder即可）
  return c.json({ status: 'success' });
});
// 删除文件夹时递归删除所有子文件夹和图片（加事务）
app.delete('/api/folders', async (c) => {
  // 删除文件夹及其所有子文件夹和图片
  const { folder } = await c.req.json();
  const { DB } = c.env;
  if (!folder || typeof folder !== 'string') return c.json({ status: 'error', message: '参数错误' }, { status: 400 });
  await DB.exec('BEGIN TRANSACTION');
  try {
    await DB.prepare('DELETE FROM images WHERE folder = ? OR folder LIKE ?').bind(folder, folder + '%').run();
    await DB.exec('COMMIT');
    return c.json({ status: 'success' });
  } catch (e) {
    await DB.exec('ROLLBACK');
    return c.json({ status: 'error', message: '批量删除文件夹失败' });
  }
});
app.put('/api/folders', async (c) => {
  // 重命名文件夹
  const { oldFolder, newFolder } = await c.req.json();
  const { DB } = c.env;
  if (!oldFolder || !newFolder) return c.json({ status: 'error', message: '参数错误' }, { status: 400 });
  // 校验新文件夹名
  const parts = newFolder.split('/').filter(Boolean);
  for (const part of parts) {
    if (!isValidFolderName(part)) {
      return c.json({ status: 'error', message: '文件夹名仅允许中英文、数字、下划线' }, { status: 400 });
    }
  }
  // 批量更新所有子项的 folder 路径
  await DB.prepare('UPDATE images SET folder = REPLACE(folder, ?, ?) WHERE folder = ? OR folder LIKE ?').bind(oldFolder, newFolder, oldFolder, oldFolder + '%').run();
  return c.json({ status: 'success' });
});

// 批量移动图片（用 D1 batch API）
app.post('/api/move_images', async (c) => {
  const { ids, target_folder } = await c.req.json();
  const { DB } = c.env;
  if (!Array.isArray(ids) || ids.length === 0 || typeof target_folder !== 'string') {
    return c.json({ status: 'error', message: '参数错误' }, { status: 400 });
  }
  let folder = target_folder.trim();
  if (!folder.startsWith('/')) folder = '/' + folder;
  if (!folder.endsWith('/')) folder += '/';
  const parts = folder.split('/').filter(Boolean);
  for (const part of parts) {
    if (!isValidFolderName(part)) {
      return c.json({ status: 'error', message: '文件夹名仅允许中英文、数字、下划线' }, { status: 400 });
    }
  }
  try {
    const stmts = ids.map(id => DB.prepare('UPDATE images SET folder = ? WHERE file_id = ?').bind(folder, id));
    await DB.batch(stmts);
    return c.json({ status: 'success' });
  } catch (e) {
    return c.json({ status: 'error', message: '批量移动失败' });
  }
});
// 批量复制图片（用 D1 batch API）
app.post('/api/copy_images', async (c) => {
  const { ids, target_folder } = await c.req.json();
  const { DB, TG_CHAT_ID } = c.env;
  if (!Array.isArray(ids) || ids.length === 0 || typeof target_folder !== 'string') {
    return c.json({ status: 'error', message: '参数错误' }, { status: 400 });
  }
  let folder = target_folder.trim();
  if (!folder.startsWith('/')) folder = '/' + folder;
  if (!folder.endsWith('/')) folder += '/';
  const parts = folder.split('/').filter(Boolean);
  for (const part of parts) {
    if (!isValidFolderName(part)) {
      return c.json({ status: 'error', message: '文件夹名仅允许中英文、数字、下划线' }, { status: 400 });
    }
  }
  try {
    const stmts = [];
    for (const id of ids) {
      const row = await DB.prepare('SELECT * FROM images WHERE file_id = ?').bind(id).first();
      if (!row) continue;
      // 生成新 short_code
      let short_code = '';
      let tryCount = 0;
      while (true) {
        short_code = genShortCode();
        const check = await DB.prepare('SELECT 1 FROM images WHERE short_code = ?').bind(short_code).first();
        if (!check) break;
        tryCount++;
        if (tryCount > 5) throw new Error('短码生成失败，请重试');
      }
      stmts.push(DB.prepare(
        'INSERT INTO images (file_id, thumb_file_id, chat_id, short_code, expire_at, tags, filename, size, folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        row.file_id, row.thumb_file_id, TG_CHAT_ID, short_code, row.expire_at, row.tags, row.filename, row.size, folder
      ));
    }
    await DB.batch(stmts);
    return c.json({ status: 'success' });
  } catch (e) {
    return c.json({ status: 'error', message: '批量复制失败' });
  }
});


// 获取JWT
function getJwtToken(c: any) {
  const auth = c.req.header('authorization') || '';
  const match = auth.match(/^Bearer (.+)$/i);
  return match ? match[1] : '';
}

// 登录接口
app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json();
  const JWT_SECRET = c.env.JWT_SECRET;
  if (username === c.env.ADMIN_USER && password === c.env.ADMIN_PASS) {
    // 生成带7天过期的JWT
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7 * 24 * 60 * 60;
    const token = await sign({ user: username, exp }, JWT_SECRET, 'HS256');
    return c.json({ status: 'success', token });
  }
  return c.json({ status: 'error', message: '用户名或密码错误' }, { status: 401 });
});

// 登出接口（前端只需删除本地token即可，这里保留接口返回成功）
app.post('/api/logout', async (c) => {
  return c.json({ status: 'success' });
});

// 需要登录的API统一校验
app.use('/api/', async (c, next) => {
  // 允许 /api/login /api/logout 不校验
  const url = c.req.url;
  if (url.includes('/api/login') || url.includes('/api/logout')) return await next();
  const token = getJwtToken(c);
  const JWT_SECRET = c.env.JWT_SECRET;
  if (!token) return c.json({ status: 'error', message: '未登录' }, { status: 401 });
  try {
    const payload = await verify(token, JWT_SECRET, 'HS256');
    c.set('jwtPayload', payload);
    // 自动续期：如果剩余时间 < 1天，生成新token
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp - now < 24 * 60 * 60) {
      const newExp = now + 7 * 24 * 60 * 60;
      const newToken = await sign({ user: payload.user, exp: newExp }, JWT_SECRET, 'HS256');
      c.header('X-Refreshed-Token', newToken);
    }
  } catch {
    return c.json({ status: 'error', message: '未登录' }, { status: 401 });
  }
  await next();
});

export default app;
