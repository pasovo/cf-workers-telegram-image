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
          message: '环境变量配置不完整',
          details: 'TG_BOT_TOKEN 和 TG_CHAT_ID 必须配置'
      }, { status: 500 });
  }

  const formData = await c.req.formData();
  const photoFile = formData.get('photo') as File;

  // 添加文件验证
  if (!photoFile || photoFile.size === 0) {
      return c.json({
          status: 'error',
          message: '请上传有效的图片文件'
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
      const statusCode = Number(response.status) || 500;
      return c.json({
        status: 'error',
        message: 'Telegram API调用失败',
        details: errorDetails
      }, { status: statusCode });
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
            message: '保存记录失败',
            details: dbError instanceof Error ? dbError.message : String(dbError)
        }, { status: 500 });
    }
      
      return c.json({ status: 'success', phonos: photo });
    } else {
      return c.json({ status: 'error', message: res.description || '上传失败' });
    }
  } catch (error: unknown) {
    console.error(error);
    return c.json({ status: 'error', message: '服务器错误' }, 500);
  }
});

// 新增：获取历史记录API
app.get('/api/history', async (c) => {
  try {
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
                message: error instanceof Error ? error.message : '获取历史记录失败'
            }, 500);
        }
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : '获取历史记录失败'
    }, 500);
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
      message: error instanceof Error ? error.message : '数据库操作失败'
    }, 500);
  }
});
export default app;
