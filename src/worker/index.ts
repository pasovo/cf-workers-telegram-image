import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import indexHtml from '../../index.html?raw';

type Bindings = {
  TG_BOT_TOKEN: string;
  TG_CHAT_ID: string;
  DB: D1Database; // 添加D1数据库类型
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/api/get_photo/:file_id', async (c) => {
  const { TG_BOT_TOKEN } = c.env;
  const file_id = c.req.param('file_id');

  const getFileResponse = await fetch(
    `https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${file_id}`
  );
  const getFileRes: {
    ok: boolean;
    result: { file_path: string };
  } = await getFileResponse.json();

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
      },
    });
  } else {
    return c.json({
      status: 'error',
      message: '获取文件失败',
    });
  }
});

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

// 上传图片处理（支持有效期和短链）
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
  // 新增：有效期参数
  const expireOption = formData.get('expire') as string || 'forever';
  let expire_at: string | null = null;
  if (expireOption === '1') expire_at = new Date(Date.now() + 86400 * 1000).toISOString();
  if (expireOption === '7') expire_at = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  if (expireOption === '30') expire_at = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
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
        const stmt = DB.prepare(
          'INSERT INTO images (file_id, chat_id, short_code, expire_at) VALUES (?, ?, ?, ?)' 
        );
        const dbResult = await stmt.bind(file_id, TG_CHAT_ID, short_code, expire_at).run();
        if (!dbResult.success) {
            throw new Error(`数据库插入失败: ${JSON.stringify(dbResult.error)}`);
        }
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
      const shortUrl = baseUrl ? `${baseUrl}/${short_code}` : `/${short_code}`;
      return c.json({ status: 'success', phonos: photo, short_code, short_url: shortUrl, expire_at });
    } else {
      return c.json({ status: 'error', message: res.description || '上传失败' });
    }
  } catch (error: unknown) {
    console.error(error);
    return c.json({ status: 'error', message: '服务器错误' }, { status: 500 });
  }
});

// 根路径短链访问
app.get('/:short_code', async (c) => {
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
  // 代理图片
  const TG_BOT_TOKEN = c.env.TG_BOT_TOKEN;
  // 获取 file_path
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
    // 添加分页和搜索参数
    const { page = '1', limit = '20', search = '' } = c.req.query();
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;

    let sql = 'SELECT * FROM images';
    let params: any[] = [];
    if (search) {
      sql += ' WHERE file_id LIKE ? OR chat_id LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
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
        total: results.length // 注意：这里只返回当前页数量，如需总数可再查 COUNT(*)
      }
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : '\u83b7\u53d6\u5386\u53f2\u8bb0\u5f55\u5931\u8d25'
    }, { status: 500 });
  }
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

// 兜底路由，返回前端 index.html
app.get('/*', (c) => {
  return c.html(indexHtml);
});

export default app;
