import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { v4 as uuidv4 } from 'uuid';

type Bindings = {
  TG_BOT_TOKEN: string;
  TG_CHAT_ID: string;
  DB: D1Database; // 添加D1数据库类型
  ADMIN_USER: string;
  ADMIN_PASS: string;
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

// 获取域名配置
function getBaseUrl(env: any, req: any) {
  // 优先用环境变量 SHORTLINK_DOMAIN，否则用请求头
  const host = req.header('x-forwarded-host');
  const proto = req.header('x-forwarded-proto') || 'https';
  return env.SHORTLINK_DOMAIN || (host ? `${proto}://${host}` : '');
}

// 上传图片处理（支持有效期、短链、标签、文件名、统计）
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
  let tags = (formData.get('tags') as string || '').trim();
  let filename = (formData.get('filename') as string || '').trim();
  if (filename) filename = sanitizeFilename(filename);
  // forever/null 表示永久
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`,
      { method: 'POST', body: formData }
    );
    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('Telegram API错误:', errorDetails);
      return c.json({
        status: 'error',
        message: 'Telegram API调用失败',
        details: errorDetails
      }, { status: 500 });
    }
    const res: {
      ok: boolean;
      result?: { photo?: Array<{ file_id: string }> };
      description?: string;
    } = await response.json();
    if (res.ok && res.result?.photo && res.result.photo.length > 0) {
      const photo = res.result.photo;
      const file_id = photo[photo.length - 1].file_id;
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
      // 保存记录到数据库
      try {
        const size = photoFile.size;
        const stmt = DB.prepare(
          'INSERT INTO images (file_id, chat_id, short_code, expire_at, tags, filename, size) VALUES (?, ?, ?, ?, ?, ?, ?)' 
        );
        const dbResult = await stmt.bind(file_id, TG_CHAT_ID, short_code, expire_at, tags, filename, size).run();
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
    console.error(error);
    return c.json({ status: 'error', message: '服务器错误' }, { status: 500 });
  }
});
// /api/get_photo/:file_id 支持缩略图
app.get('/api/get_photo/:file_id', async (c) => {
  const { TG_BOT_TOKEN } = c.env;
  const file_id = c.req.param('file_id');
  const isThumb = c.req.query('thumb') === '1';
  // 获取 file_path
  const getFileResponse = await fetch(
    `https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${file_id}`
  );
  const getFileRes: any = await getFileResponse.json();
  if (getFileRes.ok) {
    const file_path = getFileRes.result.file_path;
    let url = `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${file_path}`;
    if (isThumb) {
      // Telegram 缩略图接口（需实际测试，部分图片可能无缩略图）
      url += '?thumb=1';
    }
    const imageResponse = await fetch(url);
    const imageRes = await imageResponse.arrayBuffer();
    return new Response(imageRes, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
      },
    });
  } else {
    return c.json({
      status: 'error',
      message: '获取文件失败',
    });
  }
});
// 批量删除接口
app.post('/api/delete', async (c) => {
  const { DB } = c.env;
  const { ids } = await c.req.json(); // ids: file_id[]
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ status: 'error', message: '参数错误' }, { status: 400 });
  }
  try {
    for (const id of ids) {
      await DB.prepare('DELETE FROM images WHERE file_id = ?').bind(id).run();
    }
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
  const row = await DB.prepare('SELECT file_id, expire_at FROM images WHERE short_code = ?').bind(short_code).first();
  if (!row) {
    return c.text('链接不存在', 404);
  }
  if (row.expire_at && new Date(String(row.expire_at)).getTime() < Date.now()) {
    return c.text('链接已过期', 410);
  }
  // 访问计数+1
  await DB.prepare('UPDATE images SET visit_count = visit_count + 1 WHERE short_code = ?').bind(short_code).run();
  // 删除访问日志
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
    return new Response(imageRes, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000'
      },
    });
  } else {
    return c.text('图片获取失败', 404);
  }
});

// 新增：获取历史记录API
app.get('/api/history', async (c) => {
  try {
    const { page = '1', limit = '20', search = '', tag = '', filename = '' } = c.req.query();
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;
    let sql = 'SELECT * FROM images WHERE 1=1';
    let params: any[] = [];
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
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);
    const { results } = await c.env.DB.prepare(sql).bind(...params).all();
    return c.json({
      status: 'success',
      data: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: results.length
      }
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : '获取历史记录失败'
    }, { status: 500 });
  }
});

// 统计API
app.get('/api/stats', async (c) => {
  const { DB } = c.env;
  const total = await DB.prepare('SELECT COUNT(*) as n, COALESCE(SUM(size),0) as size FROM images').first();
  const hot = await DB.prepare('SELECT * FROM images ORDER BY visit_count DESC LIMIT 5').all();
  return c.json({
    status: 'success',
    total: total?.n || 0,
    size: total?.size || 0,
    hot: hot?.results || []
  });
});
// 设置API
app.get('/api/settings', async (c) => {
  // 鉴权
  const token = getAuthToken(c);
  if (!token || !globalAuthToken || token !== globalAuthToken) {
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

let globalAuthToken: string | null = null;

function getAuthToken(c: any) {
  const cookie = c.req.header('cookie') || '';
  const match = cookie.match(/auth_token=([^;]+)/);
  return match ? match[1] : '';
}

function setAuthCookie(token: string) {
  // 7天有效期
  return `auth_token=${token}; Path=/; HttpOnly; Max-Age=604800; SameSite=Strict`;
}

// 登录接口
app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json();
  if (username === c.env.ADMIN_USER && password === c.env.ADMIN_PASS) {
    // 生成随机 token
    const token = uuidv4();
    globalAuthToken = token;
    return c.json({ status: 'success' }, {
      headers: { 'Set-Cookie': setAuthCookie(token) }
    });
  }
  return c.json({ status: 'error', message: '用户名或密码错误' }, { status: 401 });
});

// 登出接口
app.post('/api/logout', async (c) => {
  globalAuthToken = null;
  return c.json({ status: 'success' }, {
    headers: { 'Set-Cookie': 'auth_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Strict' }
  });
});

// 需要登录的API统一校验
app.use('/api/', async (c, next) => {
  // 允许 /api/login /api/logout /api/settings 不校验
  const url = c.req.url;
  if (url.includes('/api/login') || url.includes('/api/logout') || url.includes('/api/settings')) return await next();
  const token = getAuthToken(c);
  if (!token || !globalAuthToken || token !== globalAuthToken) {
    return c.json({ status: 'error', message: '未登录' }, { status: 401 });
  }
  // 刷新cookie时效
  c.header('Set-Cookie', setAuthCookie(token));
  await next();
});

export default app;
