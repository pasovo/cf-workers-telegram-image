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

app.get('/api/getPhoto', (c) => c.json({ name: 'Cloudflare' }));

// 上传图片处理
app.post('/api/upload', async (c) => {
  const { TG_BOT_TOKEN, TG_CHAT_ID } = c.env;

  const formData = await c.req.formData();
  formData.append('chat_id', TG_CHAT_ID);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`,
      { method: 'POST', body: formData }
    );

    const res: { ok: boolean; result: { photo: { file_id: string }[] }; description: string } = await response.json();

    if (res.ok) {
      const photo = res.result.photo;
      const file_id = photo[photo.length - 1].file_id; // 获取最高分辨率图片ID
      
      // 新增：保存记录到数据库
      await c.env.DB.prepare(
        'INSERT INTO images (file_id, chat_id) VALUES (?, ?)'
      ).bind(file_id, TG_CHAT_ID).run();
      
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
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM images ORDER BY created_at DESC'
    ).all();
    return c.json({ status: 'success', data: results });
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
