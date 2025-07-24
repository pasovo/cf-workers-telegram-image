CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT NOT NULL,
  thumb_file_id TEXT,
  chat_id TEXT NOT NULL,
  short_code TEXT UNIQUE NOT NULL,
  expire_at TIMESTAMP,
  tags TEXT,
  filename TEXT,
  size INTEGER,
  folder TEXT DEFAULT '/',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  content_type TEXT
);