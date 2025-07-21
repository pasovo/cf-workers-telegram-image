import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';

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


// 上传图片处理
app.post('/api/upload', async (c) => {
  const { TG_BOT_TOKEN, TG_CHAT_ID } = c.env;

  // 添加环境变量检查
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
      return c.json({
          status: 'error',
          message: '\u73af\u5883\u53d8\u91cf\u914d\u7f6e\u4e0d\u5b8c\u6574',
          details: 'TG_BOT_TOKEN \u548c TG_CHAT_ID \u5fc5\u987b\u914d\u7f6e'
      }, { status: 500 });
  }

  const formData = await c.req.formData();
  const photoFile = formData.get('photo') as File;

  // 添加文件验证
  if (!photoFile || photoFile.size === 0) {
      return c.json({
          status: 'error',
          message: '\u8bf7\u4e0a\u4f20\u6709\u6548\u7684\u56fe\u7247\u6587\u4ef6'
      }, { status: 400 });
  }

  formData.append('chat_id', TG_CHAT_ID);

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
        message: 'Telegram API\u8c03\u7528\u5931\u8d25',
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
        const file_id = photo[photo.length - 1].file_id; // 获取最高分辨率图片ID
      
      // 新增：保存记录到数据库
      try {
        const stmt = c.env.DB.prepare(
          'INSERT INTO images (file_id, chat_id) VALUES (?, ?)'
        );
        const dbResult = await stmt.bind(file_id, TG_CHAT_ID).run();
        if (!dbResult.success) {
            throw new Error(`数据库插入失败: ${JSON.stringify(dbResult.error)}`);
        }
    } catch (dbError) {
        console.error('数据库插入错误:', dbError);
        return c.json({
            status: 'error',
            message: '\u4fdd\u5b58\u8bb0\u5f55\u5931\u8d25',
            details: dbError instanceof Error ? dbError.message : String(dbError)
        }, { status: 500 });
    }
      
      return c.json({ status: 'success', phonos: photo });
    } else {
      return c.json({ status: 'error', message: res.description || '上传失败' });
    }
  } catch (error: unknown) {
    console.error(error);
    return c.json({ status: 'error', message: '\u670d\u52a1\u5668\u9519\u8bef' }, { status: 500 });
  }
});

// 新增：获取历史记录API
app.get('/api/history', async (c) => {
  try {
    // 添加分页参数
    const { page = '1', limit = '20' } = c.req.query();
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM images ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(limitNum, offset).all();

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
export default app;
