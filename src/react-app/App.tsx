
import React, { useState, useRef } from 'react';

// 全局弹窗组件
function Toast({ message, type = 'info', onClose }: { message: string; type?: 'info' | 'error' | 'success'; onClose: () => void }) {
  // 不再用 useEffect 依赖 ErrorBoundary
  React.useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  let bg = 'bg-blue-600';
  if (type === 'error') bg = 'bg-red-600';
  if (type === 'success') bg = 'bg-green-600';
  return (
    <div className={`fixed top-6 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded shadow-lg text-white text-base font-medium ${bg} animate-fade-in`} style={{minWidth: 200, maxWidth: '90vw'}}>
      {message}
    </div>
  );
}

function AppContent() {
  const [pending, setPending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [history, setHistory] = useState<Array<{ id: number; file_id: string; created_at: string; short_code?: string; tags?: string; filename?: string }>>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(8);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0 });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'info' | 'error' | 'success' }>({ message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expire, setExpire] = useState('forever');
  const SHORTLINK_DOMAIN = (window as any).SHORTLINK_DOMAIN || '';
  const [tags, setTags] = useState('');
  const [filename, setFilename] = useState('');
  const [selected, setSelected] = useState<string[]>([]); // 多选 file_id
  const [showOriginal, setShowOriginal] = useState<{ [file_id: string]: boolean }>({});
  const [tagFilter, setTagFilter] = useState('');
  const [filenameFilter, setFilenameFilter] = useState('');
  const [files, setFiles] = useState<File[]>([]); // 多文件队列
  const [compress, setCompress] = useState(false); // 是否压缩
  const [stats, setStats] = useState<{ total: number; size: number; hot: any[] }>({ total: 0, size: 0, hot: [] });
  const [logs, setLogs] = useState<any[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  type TabType = 'upload' | 'gallery' | 'logs' | 'settings';
  const [tab, setTab] = useState<TabType>('upload');
  const [lastTab, setLastTab] = useState<TabType>(tab);
  const [fade, setFade] = useState(true);
  const [settings, setSettings] = useState<any>(null);

  // Tab切换动画
  React.useEffect(() => {
    if (tab !== lastTab) {
      setFade(false);
      const t = setTimeout(() => {
        setLastTab(tab);
        setFade(true);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [tab]);

  // 文件名过滤
  const sanitizeFilename = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

  const fetchHistory = async (pageNum = 1, limitNum = 8, searchVal = '', tagVal = '', filenameVal = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: String(limitNum) });
      if (searchVal) params.append('search', searchVal);
      if (tagVal) params.append('tag', tagVal);
      if (filenameVal) params.append('filename', filenameVal);
      const response = await fetch(`/api/history?${params.toString()}`);
      if (!response.ok) throw new Error('获取历史记录失败');
      const data = await response.json();
      if (data.status === 'success') {
        setHistory(data.data);
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total
        });
      }
    } catch (error) {
      setToast({ message: '加载历史记录失败，请刷新页面重试', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchHistory(page, limit, search, tagFilter, filenameFilter);
    // eslint-disable-next-line
  }, [page, limit, search, tagFilter, filenameFilter]);

  // 处理文件添加（多选、拖拽、粘贴）
  const handleAddFiles = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    setFiles(prev => [...prev, ...arr]);
  };
  // input 选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleAddFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  // 粘贴
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (e.clipboardData) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) setFiles(prev => [...prev, file]);
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // 拖拽上传
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) handleAddFiles(e.dataTransfer.files);
  };

  // 图片压缩（canvas）
  const compressImage = (file: File, quality = 0.7, maxW = 1600, maxH = 1600): Promise<File> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (blob) {
            resolve(new File([blob], file.name, { type: blob.type }));
          } else {
            resolve(file);
          }
          URL.revokeObjectURL(url);
        }, file.type, quality);
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  };

  // 上传队列处理
  const handleUploadAll = async () => {
    if (files.length === 0) return;
    setPending(true);
    for (const file of files) {
      let uploadFile = file;
      if (compress) uploadFile = await compressImage(file);
      const formData = new FormData();
      formData.append('photo', uploadFile);
      formData.append('expire', expire);
      formData.append('tags', tags);
      formData.append('filename', filename ? filename : uploadFile.name);
      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/upload');
          xhr.onload = () => {
            try {
              const res = JSON.parse(xhr.responseText);
              if (xhr.status === 200 && res.status === 'success') {
                setToast({ message: '图片上传成功', type: 'success' });
                fetchStats(); // 上传后刷新统计
                resolve();
              } else {
                setToast({ message: `上传失败: ${res.message || '未知错误'}`, type: 'error' });
                reject(new Error(res.message || '上传失败'));
              }
            } catch (err) {
              setToast({ message: '上传失败，服务器响应异常', type: 'error' });
              reject(err);
            }
          };
          xhr.onerror = () => {
            setToast({ message: '上传失败，请重试', type: 'error' });
            reject(new Error('上传失败'));
          };
          xhr.send(formData);
        });
      } catch {}
    }
    setFiles([]);
    setPending(false);
    setUploadProgress(0);
    setPage(1);
    setSearch('');
    setSearchInput('');
    fetchHistory(1, limit, '', tagFilter, filenameFilter);
  };

  // 搜索按钮点击
  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };
  // 回车搜索
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };
  // 分页按钮
  const handlePrevPage = () => { if (page > 1) setPage(page - 1); };
  const handleNextPage = () => { if (history.length === limit) setPage(page + 1); };

  // 复制短链/Markdown/HTML
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ message: '已复制到剪贴板', type: 'success' });
    } catch {
      setToast({ message: '复制失败', type: 'error' });
    }
  };

  // 多选操作
  const handleSelect = (file_id: string, checked: boolean) => {
    setSelected(prev => checked ? [...prev, file_id] : prev.filter(id => id !== file_id));
  };
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelected(history.map(i => i.file_id));
    else setSelected([]);
  };
  // 批量删除
  const handleBatchDelete = async () => {
    if (selected.length === 0) return;
    if (!window.confirm('确定要删除选中的图片记录吗？')) return;
    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setToast({ message: '删除成功', type: 'success' });
        setSelected([]);
        fetchHistory(page, limit, search, tagFilter, filenameFilter);
        fetchStats(); // 删除后刷新统计
      } else {
        setToast({ message: '删除失败', type: 'error' });
      }
    } catch {
      setToast({ message: '删除失败', type: 'error' });
    }
  };
  // 批量导出
  const handleBatchExport = () => {
    if (selected.length === 0) return;
    const exportData = history.filter(i => selected.includes(i.file_id));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  // 缩略图/原图切换
  const handleToggleImage = (file_id: string) => {
    setShowOriginal(prev => ({ ...prev, [file_id]: !prev[file_id] }));
  };

  // 删除待上传图片
  const handleRemoveFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // 获取统计
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.status === 'success') setStats(data);
    } catch {}
  };
  React.useEffect(() => { fetchStats(); }, []);

  // 获取日志
  const fetchLogs = async (page = 1) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/logs?page=${page}&limit=20`);
      const data = await res.json();
      if (data.status === 'success') {
        setLogs(data.data);
        setLogsPage(page);
      }
    } catch {}
    setLogsLoading(false);
  };

  // 获取设置
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.status === 'success') setSettings(data);
    } catch {}
  };
  React.useEffect(() => { if (tab === 'settings') fetchSettings(); }, [tab]);

  return (
    <div className="min-h-screen bg-[#10151b]">
      {/* 顶部导航栏 */}
      <nav className="w-full flex items-center justify-between px-6 py-3 bg-[#181f29] shadow-lg sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold text-xl tracking-wider flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#22d3ee" strokeWidth="2"/><path d="M8 12l2.5 2.5L16 9" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            sasovo
          </span>
        </div>
        <div className="flex gap-2">
          <button className={tab==='upload' ? 'nav-btn nav-btn-active' : 'nav-btn'} onClick={()=>setTab('upload')}>上传</button>
          <button className={tab==='gallery' ? 'nav-btn nav-btn-active' : 'nav-btn'} onClick={()=>setTab('gallery')}>图库</button>
          <button className={tab==='logs' ? 'nav-btn nav-btn-active' : 'nav-btn'} onClick={()=>setTab('logs')}>日志</button>
          <button className={tab==='settings' ? 'nav-btn nav-btn-active' : 'nav-btn'} onClick={()=>setTab('settings')}>设置</button>
        </div>
        <div className="flex items-center gap-2">
          <input className="bg-[#232b36] rounded px-3 py-1 text-sm text-gray-200 focus:outline-none" placeholder="搜索" style={{width:120}} />
          <button className="text-gray-400 hover:text-cyan-400"><svg width="20" height="20" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/><path d="M15 15l-2.5-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
        </div>
      </nav>
      {/* Banner区块已移除 */}
      <div className="container mx-auto max-w-4xl px-2 sm:px-4 py-8">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '' })} />
        {/* 统计区块，仅在上传/图库页显示 */}
        {(tab==='upload'||tab==='gallery') && (
          <div className="flex gap-8 mb-8">
            <div className="card flex-1 flex flex-col items-center">
              <span className="text-2xl font-bold text-cyan-400">{stats.total}</span>
              <span className="text-xs text-gray-400 mt-1">上传总数</span>
            </div>
            <div className="card flex-1 flex flex-col items-center">
              <span className="text-2xl font-bold text-cyan-400">{(stats.size / 1024 / 1024).toFixed(2)} MB</span>
              <span className="text-xs text-gray-400 mt-1">空间占用</span>
            </div>
          </div>
        )}
        {/* 其余Tab内容卡片化 */}
        <div className={`fade-content${fade ? '' : ' fade-content-leave'}`} key={tab}>
          {tab==='upload' && (
            <div
              className={`card card-hover mb-8 transition-all duration-200 ${dragActive ? 'ring-4 ring-cyan-400 shadow-2xl' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleUploadAll(); }}>
                {/* 拖拽/粘贴/多选上传区域 */}
                <div className="space-y-2 flex flex-col items-center">
                  <label
                    htmlFor="photo"
                    className="w-full bg-[#232b36] hover:bg-[#232b36]/80 text-gray-200 font-medium py-2 px-4 rounded-md border border-[#232b36] transition duration-300 flex items-center justify-center cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    选择图片（可多选/拖拽/粘贴）
                    <input
                      type="file"
                      id="photo"
                      name="photo"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                    />
                  </label>
                  {files.length > 0 && (
                    <div className="w-full flex flex-wrap gap-2 mt-2">
                      {files.map((file, idx) => (
                        <div key={idx} className="relative flex flex-col items-center border rounded p-2 bg-[#232b36]">
                          <button
                            className="absolute -top-2 -right-2 w-6 h-6 bg-[#232b36] text-gray-400 hover:text-red-400 rounded-full flex items-center justify-center shadow"
                            type="button"
                            title="移除"
                            onClick={() => handleRemoveFile(idx)}
                          >
                            ×
                          </button>
                          <img src={URL.createObjectURL(file)} alt="预览" className="w-16 h-16 object-cover rounded mb-1" />
                          <span className="text-xs break-all max-w-[80px] text-gray-300">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* 压缩选项 */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-lg font-medium text-sm transition border-2 ${compress ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-[#232b36] border-[#232b36] text-gray-300'} hover:border-cyan-400`}
                    onClick={() => setCompress(v => !v)}
                  >
                    {compress ? '✓ ' : ''}上传前压缩图片
                  </button>
                </div>
                {/* 标签输入 */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-300">标签：</label>
                  <input
                    className="border rounded px-2 py-1 flex-1 bg-[#232b36] text-gray-100"
                    type="text"
                    name="tags"
                    placeholder="多个标签用逗号分隔"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                  />
                </div>
                {/* 文件名输入 */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-300">文件名：</label>
                  <input
                    className="border rounded px-2 py-1 flex-1 bg-[#232b36] text-gray-100"
                    type="text"
                    name="filename"
                    placeholder="自定义文件名"
                    value={filename}
                    onChange={e => setFilename(sanitizeFilename(e.target.value))}
                    maxLength={64}
                  />
                  <span className="text-xs text-gray-400">仅字母数字._-</span>
                </div>
                {/* 有效期选择 */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-300">有效期：</label>
                  <select
                    className="border rounded px-2 py-1 bg-[#232b36] text-gray-100"
                    value={expire}
                    onChange={e => setExpire(e.target.value)}
                    name="expire"
                  >
                    <option value="forever">永久</option>
                    <option value="1">1天</option>
                    <option value="7">7天</option>
                    <option value="30">30天</option>
                  </select>
                </div>
                {/* 上传进度条 */}
                {pending && (
                  <div className="w-full h-3 bg-gray-700 rounded overflow-hidden animate-pulse">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-300 disabled:bg-blue-400 disabled:cursor-not-allowed"
                    disabled={pending || files.length === 0}
                  >
                    {pending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                        批量上传中...
                      </span>
                    ) : '批量上传'}
                  </button>
                </div>
              </form>
            </div>
          )}
          {tab==='gallery' && (
            <div className="card card-hover mb-8">
              <div className="mt-8 sm:mt-12 max-w-3xl mx-auto">
                <h2 className="text-xl sm:text-2xl font-semibold mb-4">上传历史记录</h2>
                {/* 筛选栏 */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="标签筛选"
                    className="border rounded px-2 py-1"
                    value={tagFilter}
                    onChange={e => setTagFilter(e.target.value)}
                    style={{ width: 120 }}
                  />
                  <input
                    type="text"
                    placeholder="文件名筛选"
                    className="border rounded px-2 py-1"
                    value={filenameFilter}
                    onChange={e => setFilenameFilter(e.target.value)}
                    style={{ width: 120 }}
                  />
                  <input
                    type="text"
                    placeholder="搜索 file_id 或 chat_id"
                    className="border rounded px-2 py-1"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    style={{ width: 180 }}
                  />
                  <button
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    onClick={handleSearch}
                    type="button"
                  >
                    搜索
                  </button>
                </div>
                {/* 批量操作栏 */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-lg font-medium text-sm transition border-2 ${selected.length === history.length && history.length > 0 ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-[#232b36] border-[#232b36] text-gray-300'} hover:border-cyan-400`}
                    onClick={() => handleSelectAll(!(selected.length === history.length && history.length > 0))}
                  >
                    {selected.length === history.length && history.length > 0 ? '✓ ' : ''}全选
                  </button>
                  <button className="px-2 py-1 bg-red-500 text-white rounded disabled:opacity-50" disabled={selected.length === 0} onClick={handleBatchDelete}>批量删除</button>
                  <button className="px-2 py-1 bg-green-500 text-white rounded disabled:opacity-50" disabled={selected.length === 0} onClick={handleBatchExport}>导出JSON</button>
                </div>
                {/* 分页按钮 */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                    onClick={handlePrevPage}
                    disabled={page === 1 || loading}
                  >上一页</button>
                  <span>第 {pagination.page} 页</span>
                  <button
                    className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                    onClick={handleNextPage}
                    disabled={history.length < limit || loading}
                  >下一页</button>
                </div>
                {loading ? (
                  <p className="text-gray-500 text-center py-6">加载中...</p>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <svg className="w-16 h-16 text-gray-300 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-gray-500 text-center">暂无上传记录</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {history.map(item => {
                      const shortUrl = `${SHORTLINK_DOMAIN || window.location.origin}/img/${item.short_code || ''}`;
                      const md = `![](${shortUrl})`;
                      const html = `<img src=\"${shortUrl}\" />`;
                      const isChecked = selected.includes(item.file_id);
                      const isShowOriginal = showOriginal[item.file_id];
                      return (
                        <div key={item.id} className="border rounded-lg p-4 flex flex-col gap-2 hover:shadow-md transition-shadow bg-white">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition ${isChecked ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-[#232b36] border-[#232b36] text-gray-300'} hover:border-cyan-400`}
                              onClick={() => handleSelect(item.file_id, !isChecked)}
                              title={isChecked ? '取消选择' : '选择'}
                            >
                              {isChecked ? '✓' : ''}
                            </button>
                            <img 
                              src={`/api/get_photo/${item.file_id}${isShowOriginal ? '' : '?thumb=1'}`}
                              alt="History preview" 
                              className="w-20 h-20 object-cover rounded cursor-pointer"
                              onClick={() => handleToggleImage(item.file_id)}
                              onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/100?text=加载失败'}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate max-w-[200px]">{item.file_id}</p>
                              <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</p>
                              {item.filename && <p className="text-xs text-blue-600">文件名: {item.filename}</p>}
                              {item.tags && <p className="text-xs text-green-600">标签: {item.tags}</p>}
                              <button className="text-xs text-blue-500 underline mt-1" onClick={() => handleToggleImage(item.file_id)} type="button">
                                {isShowOriginal ? '查看缩略图' : '查看原图'}
                              </button>
                            </div>
                          </div>
                          {/* 短链展示与复制 */}
                          {item.short_code && (
                            <div className="mt-2 flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">短链：</span>
                                <a href={shortUrl} target="_blank" rel="noopener" className="text-blue-600 underline break-all">{shortUrl}</a>
                                <button className="ml-2 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200" onClick={() => handleCopy(shortUrl)} type="button">复制</button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Markdown：</span>
                                <input className="border px-1 py-0.5 text-xs w-36" value={md} readOnly />
                                <button className="ml-2 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200" onClick={() => handleCopy(md)} type="button">复制</button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">HTML：</span>
                                <input className="border px-1 py-0.5 text-xs w-36" value={html} readOnly />
                                <button className="ml-2 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200" onClick={() => handleCopy(html)} type="button">复制</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {tab==='logs' && (
            <div className="card card-hover mb-8">
              <div className="max-w-2xl w-full p-6 mx-auto">
                <h2 className="text-lg font-bold mb-4 text-cyan-400">使用日志</h2>
                {logsLoading ? <div className="text-center py-8 text-gray-400">加载中...</div> : (
                  <div className="overflow-x-auto max-h-[60vh]">
                    <table className="min-w-full text-xs text-gray-100">
                      <thead>
                        <tr className="bg-[#232b36] text-gray-400">
                          <th className="px-2 py-1">时间</th>
                          <th className="px-2 py-1">类型</th>
                          <th className="px-2 py-1">file_id</th>
                          <th className="px-2 py-1">IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map(log => (
                          <tr key={log.id} className="border-b border-[#232b36]">
                            <td className="px-2 py-1 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="px-2 py-1">{log.type}</td>
                            <td className="px-2 py-1 break-all max-w-[120px]">{log.file_id}</td>
                            <td className="px-2 py-1">{log.ip}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-between items-center mt-2">
                      <button className="px-2 py-1 bg-[#232b36] text-gray-200 rounded" disabled={logsPage === 1} onClick={() => fetchLogs(logsPage - 1)}>上一页</button>
                      <span className="text-gray-400">第 {logsPage} 页</span>
                      <button className="px-2 py-1 bg-[#232b36] text-gray-200 rounded" disabled={logs.length < 20} onClick={() => fetchLogs(logsPage + 1)}>下一页</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {tab==='settings' && (
            <div className="card card-hover mb-8 flex justify-center">
              <div className="max-w-md w-full p-6 mx-auto">
                <h2 className="text-lg font-bold mb-4 text-cyan-400">系统设置</h2>
                {settings ? (
                  <ul className="text-sm text-gray-100 space-y-2">
                    <li><b>短链域名：</b>{settings.domain}</li>
                    {/* <li><b>Telegram Chat ID：</b>{settings.chat_id}</li> */}
                    <li><b>图片总数：</b>{settings.total}</li>
                    <li><b>空间占用：</b>{(settings.size/1024/1024).toFixed(2)} MB</li>
                  </ul>
                ) : <div className="text-gray-400">加载中...</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AppContent;
