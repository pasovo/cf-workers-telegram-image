
import React, { useState, useRef, useEffect } from 'react';
import SparkMD5 from 'spark-md5';
import Masonry from 'react-masonry-css';

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

function App() {
  const [authChecked, setAuthChecked] = React.useState(false);
  const [isAuthed, setIsAuthed] = React.useState(false);

  React.useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setAuthChecked(true);
      setIsAuthed(false);
      return;
    }
    fetchWithAuth('/api/settings')
      .then(res => {
        if (res.status === 401) setIsAuthed(false);
        else setIsAuthed(true);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center bg-[#10151b] text-white text-lg">正在检查登录状态...</div>;
  }
  return <AppContent isAuthed={isAuthed} setIsAuthed={setIsAuthed} />;
}

function AppContent({ isAuthed, setIsAuthed }: { isAuthed: boolean; setIsAuthed: (v: boolean) => void }) {
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState<Array<{ id: number; file_id: string; created_at: string; short_code?: string; tags?: string; filename?: string }>>([]);
  const [search] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'info' | 'error' | 'success' }>({ message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expire, setExpire] = useState('forever');
  const SHORTLINK_DOMAIN = (window as any).SHORTLINK_DOMAIN || '';
  const [selected, setSelected] = useState<string[]>([]); // 多选 file_id
  const [tagFilter, setTagFilter] = useState('');
  const [filenameFilter] = useState('');
  const [files, setFiles] = useState<File[]>([]); // 待上传文件队列
  const [stats, setStats] = useState<{ total: number; size: number; hot: any[] }>({ total: 0, size: 0, hot: [] });
  const [dragActive, setDragActive] = useState(false);
  type TabType = 'upload' | 'gallery' | 'settings';
  const [tab, setTab] = useState<TabType>('upload');
  const [lastTab, setLastTab] = useState<TabType>(tab);
  const [fade, setFade] = useState(true);
  const [enter, setEnter] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  // 弹窗相关
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<any>(null);
  const openModal = (item: any) => { setModalItem(item); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setModalItem(null); };
  // 图片详细信息弹窗尺寸和大小
  const [imgInfo, setImgInfo] = useState<{ width: number; height: number; size: number }>({ width: 0, height: 0, size: 0 });
  const [selectMode, setSelectMode] = useState(false);

  // 标签相关
  const [tagOptions, setTagOptions] = useState<string[]>(['默认']);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTag, setNewTag] = useState('');

  // 页面标题和网站图标
  const [pageTitle, setPageTitle] = useState<string>(() => localStorage.getItem('pageTitle') || '图床');
  const [faviconUrl, setFaviconUrl] = useState<string>(() => localStorage.getItem('faviconUrl') || '/favicon.ico');
  const [titleInput, setTitleInput] = useState(pageTitle);
  const [faviconFile, setFaviconFile] = useState<File|null>(null);

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !tagOptions.includes(tag)) {
      setTagOptions(prev => [...prev, tag]);
      setSelectedTags(prev => [...prev, tag]);
    }
    setNewTag('');
    setShowAddTag(false);
  };

  // Tab切换动画
  React.useEffect(() => {
    if (tab !== lastTab) {
      setFade(false);
      setEnter(true);
      const t = setTimeout(() => {
        setLastTab(tab);
        setFade(true);
        setEnter(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [tab]);

  // 页面标题和favicon同步
  useEffect(() => {
    document.title = pageTitle || '图床';
    if (faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
    }
  }, [pageTitle, faviconUrl]);

  // 1. 新增分页相关状态
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const LIMIT = 20;

  // 2. fetchHistory支持分页，支持追加
  const fetchHistory = async (searchVal = '', tagVal = '', filenameVal = '', pageNum = 1, append = false) => {
    if (!isAuthed) return;
    if (isLoadingMore) return;
    if (!append) setLoading(true);
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (searchVal) params.append('search', searchVal);
      if (tagVal) params.append('tag', tagVal);
      if (filenameVal) params.append('filename', filenameVal);
      params.append('page', String(pageNum));
      params.append('limit', String(LIMIT));
      const response = await fetchWithAuth(`/api/history?${params.toString()}`);
      if (!response.ok) throw new Error('获取历史记录失败');
      const data = await response.json();
      if (data.status === 'success') {
        if (append) {
          setHistory(prev => [...prev, ...data.data]);
        } else {
          setHistory(data.data);
        }
        // 提取所有图片的标签
        const allTags = data.data
          .map((item: any) => (item.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean))
          .flat();
        const uniqueTags = Array.from(new Set(allTags)) as string[];
        setTagOptions(uniqueTags.length > 0 ? uniqueTags : ['默认']);
        // 判断是否还有更多
        setHasMore(data.data.length >= LIMIT);
      } else {
        setToast({ message: data.message || '加载历史记录失败', type: 'error' });
      }
    } catch (error) {
      if (error instanceof Error && !/no such table|not found|not exist|not found/i.test(error.message)) {
        setToast({ message: '加载历史记录失败，请刷新页面重试', type: 'error' });
      }
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  // 3. useEffect依赖变化时重置分页
  useEffect(() => {
    if (!isAuthed) return;
    setPage(1);
    setHasMore(true);
    fetchHistory(search, tagFilter, filenameFilter, 1, false);
  }, [isAuthed, search, tagFilter, filenameFilter]);

  // 处理文件添加（多选、拖拽、粘贴）
  // 修改 handleAddFiles，自动去重
  const handleAddFiles = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    setFiles(prev => {
      // 按文件名和大小去重
      const existing = new Set(prev.map(f => f.name + '_' + f.size));
      const newFiles = arr.filter(f => !existing.has(f.name + '_' + f.size));
      return [...prev, ...newFiles];
    });
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
        // 多次尝试压缩到10MB以下
        const tryCompress = (q: number) => {
          canvas.toBlob(blob => {
            if (blob) {
              if (blob.size <= 10 * 1024 * 1024 || q < 0.2) {
                resolve(new File([blob], file.name, { type: blob.type }));
              } else {
                tryCompress(q - 0.1);
              }
            } else {
              resolve(file);
            }
            URL.revokeObjectURL(url);
          }, file.type, q);
        };
        tryCompress(quality);
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  };

  // 计算文件 hash 的工具函数
  const calcFileHash = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const chunkSize = 2 * 1024 * 1024; // 2MB
      const chunks = Math.ceil(file.size / chunkSize);
      let currentChunk = 0;
      const spark = new SparkMD5.ArrayBuffer();
      const fileReader = new FileReader();
      fileReader.onload = e => {
        spark.append(e.target!.result as ArrayBuffer);
        currentChunk++;
        if (currentChunk < chunks) {
          loadNext();
        } else {
          resolve(spark.end());
        }
      };
      fileReader.onerror = () => reject('hash error');
      function loadNext() {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        fileReader.readAsArrayBuffer(file.slice(start, end));
      }
      loadNext();
    });
  };

  // 上传队列处理
  // 1. 设置页支持自定义最大并发上传数
  const [maxConcurrentUploads, setMaxConcurrentUploads] = useState(() => Number(localStorage.getItem('maxConcurrentUploads')) || 3);
  // 2. 上传队列多线程上传实现
  const uploadQueueRef = useRef<File[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number[]>([]); // 正在上传的索引
  const [failedIdx, setFailedIdx] = useState<number[]>([]); // 上传失败的索引
  const [totalProgress, setTotalProgress] = useState(0);

  // 单文件上传逻辑，供多线程上传队列调用
  const uploadFile = async (file: File) => {
    let uploadFile = file;
    if (file.size > 10 * 1024 * 1024) {
      uploadFile = await compressImage(file);
      if (uploadFile.size > 10 * 1024 * 1024) {
        setToast({ message: '图片压缩后仍大于10MB，无法上传', type: 'error' });
        throw new Error('图片过大');
      }
    }
    const formData = new FormData();
    formData.append('photo', uploadFile);
    formData.append('expire', expire);
    const tagsToUpload = selectedTags.length > 0 ? selectedTags : ['默认'];
    formData.append('tags', tagsToUpload.join(','));
    formData.append('filename', uploadFile.name);
    // 不再传 hash 字段
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
  };

  const handleUploadAll = async () => {
    if (files.length === 0) return;
    setPending(true);
    uploadQueueRef.current = files.slice();
    setUploadingIdx([]);
    setFailedIdx([]);
    setTotalProgress(0);
    let active = 0;
    let finished = 0;
    const total = files.length;
    const failedIdxLocal: number[] = [];
    const uploadingFileKeySet = new Set<string>();
    const localUploadingHashes = new Set<string>();
    const next = async () => {
      if (uploadQueueRef.current.length === 0) return;
      if (active >= maxConcurrentUploads) return;
      const idx = files.length - uploadQueueRef.current.length;
      const file = uploadQueueRef.current.shift();
      if (!file) return;
      // 先锁定文件唯一 key（如 name+size），防止同一文件并发上传
      const fileKey = file.name + '_' + file.size;
      if (uploadingFileKeySet.has(fileKey)) {
        finished++;
        setTotalProgress(Math.round((finished / total) * 100));
        if (finished < total) next();
        return;
      }
      uploadingFileKeySet.add(fileKey);
      setUploadingIdx(prev => [...prev, idx]);
      active++;
      try {
        // 计算 hash
        const hash = await calcFileHash(file);
        // hash 去重，防止并发竞态
        if (localUploadingHashes.has(hash)) {
          finished++;
          setTotalProgress(Math.round((finished / total) * 100));
          setUploadingIdx(prev => prev.filter(i => i !== idx));
          uploadingFileKeySet.delete(fileKey);
          if (finished < total) next();
          return;
        }
        localUploadingHashes.add(hash);
        // 上传
        await uploadFile(file);
        setUploadingIdx(prev => prev.filter(i => i !== idx));
        fetchHistory(search, tagFilter, filenameFilter);
      } catch {
        setUploadingIdx(prev => prev.filter(i => i !== idx));
        failedIdxLocal.push(idx);
      } finally {
        // 上传完成后移除锁定
        uploadingFileKeySet.delete(fileKey);
        // hash 也可以移除（如需允许同 hash 文件后续重试）
        // localUploadingHashes.delete(hash); // 可选
        active--;
        finished++;
        setTotalProgress(Math.round((finished / total) * 100));
        if (finished < total) next();
      }
    };
    // 启动并发上传
    for (let i = 0; i < maxConcurrentUploads; i++) next();
    // 等待全部完成
    while (finished < total) await new Promise(r => setTimeout(r, 100));
    setFiles(prev => prev.filter((_, i) => failedIdxLocal.includes(i)));
    setFailedIdx(failedIdxLocal);
    setPending(false);
    setTotalProgress(0);
  };

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
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelected(history.map(i => i.file_id));
    else setSelected([]);
  };
  // 批量删除
  const handleBatchDelete = async () => {
    if (selected.length === 0) return;
    if (!window.confirm('确定要删除选中的图片记录吗？')) return;
    // 记录当前被选中的图片
    const removed = history.filter(item => selected.includes(item.file_id));
    // 立即前端移除
    setHistory(prev => prev.filter(item => !selected.includes(item.file_id)));
    setSelected([]);
    setToast({ message: '已提交删除', type: 'info' });
    // 后台异步删除
    try {
      const token = localStorage.getItem('jwt_token') || '';
      const res = await fetchWithAuth('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ids: selected })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setToast({ message: '删除成功', type: 'success' });
        fetchStats(); // 删除后刷新统计
      } else {
        // 回滚
        setHistory(prev => [...removed, ...prev]);
        setToast({ message: '删除失败，请重试', type: 'error' });
      }
    } catch {
      setHistory(prev => [...removed, ...prev]);
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

  // 删除待上传图片
  const handleRemoveFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // 获取统计
  const fetchStats = async () => {
    if (!isAuthed) return;
    try {
      const res = await fetchWithAuth('/api/stats');
      const data = await res.json();
      if (data.status === 'success') setStats(data);
    } catch (err) {}
  };
  React.useEffect(() => { if (isAuthed) fetchStats(); }, [isAuthed]);

  // 获取设置
  const fetchSettings = async () => {
    if (!isAuthed) return;
    try {
      const res = await fetchWithAuth('/api/settings');
      const data = await res.json();
      if (data.status === 'success') setSettings(data);
    } catch {}
  };
  React.useEffect(() => { if (isAuthed && tab === 'settings') fetchSettings(); }, [isAuthed, tab]);

  // 弹窗打开时获取图片尺寸和大小
  React.useEffect(() => {
    if (!modalOpen || !modalItem) return;
    // 获取尺寸
    const img = new window.Image();
    img.onload = () => {
      setImgInfo(prev => ({ ...prev, width: img.naturalWidth, height: img.naturalHeight }));
    };
    img.src = `/api/get_photo/${modalItem.file_id}`;
    // 获取大小
    fetchWithAuth(`/api/get_photo/${modalItem.file_id}`)
      .then(res => {
        const size = Number(res.headers.get('content-length')) || 0;
        setImgInfo(prev => ({ ...prev, size }));
      });
  }, [modalOpen, modalItem]);

  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // 登录方法
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginPending(true);
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.token) {
        localStorage.setItem('jwt_token', data.token);
        setIsAuthed(true);
        setLoginUser('');
        setLoginPass('');
        setLoginError('');
        window.location.reload(); // 登录成功后强制刷新页面
      } else {
        setLoginError(data.message || '登录失败');
      }
    } catch {
      setLoginError('网络错误，请重试');
    }
    setLoginPending(false);
  };

  // 登出方法
  const handleLogout = async () => {
    localStorage.removeItem('jwt_token');
    await fetchWithAuth('/api/logout', { method: 'POST' });
    setIsAuthed(false);
    setToast({ message: '已退出登录', type: 'info' });
    window.location.reload(); // 强制刷新页面，确保退出
  };

  // 未登录时渲染登录界面
  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#10151b]">
        <div className="card card-hover w-full max-w-xs mx-auto p-8 flex flex-col items-center">
          <h2 className="text-2xl font-bold text-cyan-400 mb-6">登录</h2>
          <form className="w-full space-y-4" onSubmit={handleLogin}>
            <input
              className="w-full border rounded px-3 py-2 bg-[#232b36] text-gray-100 focus:outline-none focus:border-cyan-400"
              placeholder="用户名"
              value={loginUser}
              onChange={e => setLoginUser(e.target.value)}
              autoFocus
              disabled={loginPending}
            />
            <input
              className="w-full border rounded px-3 py-2 bg-[#232b36] text-gray-100 focus:outline-none focus:border-cyan-400"
              placeholder="密码"
              type="password"
              value={loginPass}
              onChange={e => setLoginPass(e.target.value)}
              disabled={loginPending}
            />
            {loginError && <div className="text-red-500 text-sm text-center">{loginError}</div>}
            <button
              type="submit"
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 px-4 rounded-md transition duration-300 disabled:bg-cyan-400 disabled:cursor-not-allowed"
              disabled={loginPending || !loginUser || !loginPass}
            >{loginPending ? '登录中...' : '登录'}</button>
          </form>
        </div>
      </div>
    );
  }

  // 骨架屏组件
  const SkeletonItem = () => (
    <div style={{
      margin: 6,
      borderRadius: 12,
      background: 'linear-gradient(90deg, #232b36 60%, #2a3342 100%)',
      height: 240,
      width: '100%',
      minHeight: 120,
      minWidth: 120,
      boxShadow: '0 2px 8px #232b3633',
      animation: 'pulse 1.2s infinite',
    }} />
  );

  // MasonryList渲染函数
  const renderMasonryItem = (img: any) => {
    if (img.skeleton) return <SkeletonItem />;
    const isSelected = selectMode && selected.includes(img.file_id);
    return (
      <div
        key={img.id}
        style={{
          margin: 6,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#232b36',
          boxShadow: isSelected ? '0 0 0 4px #22d3ee' : undefined,
          opacity: selectMode ? 0.8 : 1,
          cursor: 'pointer',
          position: 'relative',
        }}
        onClick={() => {
          if (selectMode) {
            if (isSelected) setSelected(prev => prev.filter(id => id !== img.file_id));
            else setSelected(prev => [...prev, img.file_id]);
          } else {
            openModal(img);
          }
        }}
      >
        <img
          src={img.url || `/api/get_photo/${img.file_id}?thumb=1`}
          alt={img.filename || img.file_id}
          style={{ width: '100%', display: 'block', borderRadius: 12, maxHeight: 320, objectFit: 'cover' }}
          loading="lazy"
          onError={e => (e.currentTarget.src = 'https://via.placeholder.com/200?text=加载失败')}
        />
        {isSelected && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: '#22d3ee',
            color: '#fff',
            borderRadius: '50%',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: 16,
          }}>✓</div>
        )}
      </div>
    );
  };

  // Masonry断点配置
  const breakpointColumnsObj = {
    default: 6,
    1200: 5,
    900: 4,
    700: 3,
    500: 2
  };

  // Masonry items准备
  const displayItems = loading && history.length === 0
    ? Array.from({ length: 20 }, (_, i) => ({ skeleton: true, id: 'skeleton-' + i }))
    : history;

  // 在 AppContent 组件内部添加 handleDeduplicate 函数（带进度条和并发下载）
  const handleDeduplicate = async () => {
    setToast({ message: '正在去重...', type: 'info' });
    setDedupProgress(0); // 新增dedupProgress状态
    // 1. 拉取所有图片历史（分页拉取）
    type ImageItem = { file_id: string; filename?: string };
    let allImages: ImageItem[] = [];
    let page = 1, hasMore = true;
    const pageSize = 100;
    while (hasMore) {
      const res = await fetchWithAuth(`/api/history?page=${page}&limit=${pageSize}`);
      const data = await res.json();
      if (data.status === 'success') {
        allImages = allImages.concat(data.data as ImageItem[]);
        hasMore = (data.data as ImageItem[]).length === pageSize;
        page++;
      } else {
        setToast({ message: '加载图片历史失败', type: 'error' });
        setDedupProgress(0);
        return;
      }
    }
    // 2. 并发下载所有图片并计算 hash
    const hashMap: Record<string, ImageItem[]> = {};
    const toDelete: string[] = [];
    const concurrency = 6; // 并发数
    let finished = 0;
    const total = allImages.length;
    const tasks = allImages.map((img) => async () => {
      try {
        const resp = await fetchWithAuth(`/api/get_photo/${img.file_id}`);
        if (!resp.ok) return;
        const buf = await resp.arrayBuffer();
        const hash = await calcFileHash(new File([buf], img.filename || img.file_id));
        if (!hashMap[hash]) hashMap[hash] = [];
        hashMap[hash].push(img);
      } catch {}
      finished++;
      setDedupProgress(Math.round((finished / total) * 100));
    });
    // 并发执行
    const runConcurrent = async (taskList: (() => Promise<void>)[], limit: number) => {
      let idx = 0;
      const runners = Array.from({ length: limit }).map(async () => {
        while (idx < taskList.length) {
          const cur = idx++;
          await taskList[cur]();
        }
      });
      await Promise.all(runners);
    };
    await runConcurrent(tasks, concurrency);
    // 3. 分组去重，保留每组第一个，其余加入待删除
    Object.values(hashMap).forEach((group: ImageItem[]) => {
      if (group.length > 1) {
        group.slice(1).forEach((img: ImageItem) => toDelete.push(img.file_id));
      }
    });
    if (toDelete.length === 0) {
      setToast({ message: '无重复图片', type: 'success' });
      setDedupProgress(0);
      return;
    }
    // 4. 批量删除
    const res = await fetchWithAuth('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt_token') || ''}` },
      body: JSON.stringify({ ids: toDelete })
    });
    const data = await res.json();
    setDedupProgress(0);
    if (data.status === 'success') {
      setToast({ message: `去重完成，删除了${toDelete.length}条重复图片`, type: 'success' });
      fetchHistory();
    } else {
      setToast({ message: '去重失败', type: 'error' });
    }
  };

  // 新增dedupProgress状态
  const [dedupProgress, setDedupProgress] = useState(0);

  return (
    <div className="min-h-screen bg-[#10151b]">
      {/* 顶部导航栏 */}
      <nav className="w-full flex items-center justify-between px-6 py-3 bg-[#181f29] shadow-lg sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-[120px]">
          <span className="text-cyan-400 font-bold text-xl tracking-wider flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#22d3ee" strokeWidth="2"/><path d="M8 12l2.5 2.5L16 9" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            sasovo
          </span>
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex gap-2">
            <button className={tab==='upload' ? 'nav-btn nav-btn-active' : 'nav-btn'} onClick={()=>setTab('upload')}>上传</button>
            <button className={tab==='gallery' ? 'nav-btn nav-btn-active' : 'nav-btn'} onClick={()=>setTab('gallery')}>图库</button>
            <button className={tab==='settings' ? 'nav-btn nav-btn-active' : 'nav-btn'} onClick={()=>setTab('settings')}>设置</button>
          </div>
        </div>
        <div className="min-w-[120px]"></div>
      </nav>
      {/* Banner区块已移除 */}
      <div className="container mx-auto max-w-4xl px-2 sm:px-4 py-8">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '' })} />
        {/* 统计区块，仅在上传/图库页显示 */}
        {(tab==='upload'||tab==='gallery') && false && (
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
        <div className={`fade-content${fade ? '' : ' fade-content-leave'}${enter ? ' fade-content-enter' : ''}${fade && !enter ? ' fade-content-enter-active' : ''}`} key={tab}>
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
                </div>
                {/* 标签输入 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-300">标签：</span>
                  {tagOptions.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className={`px-3 py-1 rounded-lg font-medium text-sm transition border-2 mr-1 mb-1 ${selectedTags.includes(tag) ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-[#232b36] border-[#232b36] text-gray-300'} hover:border-cyan-400`}
                      onClick={() => handleToggleTag(tag)}
                    >
                      {selectedTags.includes(tag) ? '✓ ' : ''}{tag}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="px-3 py-1 rounded-lg font-medium text-sm transition border-2 bg-[#232b36] border-[#232b36] text-cyan-400 hover:border-cyan-400 mb-1"
                    onClick={() => setShowAddTag(true)}
                  >+
                  </button>
                  {showAddTag && (
                    <input
                      type="text"
                      className="border rounded px-2 py-1 bg-[#232b36] text-gray-100 ml-2"
                      placeholder="新标签"
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      onBlur={handleAddTag}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }}
                      autoFocus
                      style={{ width: 80 }}
                    />
                  )}
                </div>
                {/* 有效期选择 */}
                <span className="text-sm text-gray-300">有效期：</span>
                {[
                  { label: '永久', value: 'forever' },
                  { label: '1天', value: '1' },
                  { label: '7天', value: '7' },
                  { label: '30天', value: '30' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`px-3 py-1 rounded-lg font-medium text-sm transition border-2 mr-2 mb-1 ${expire === opt.value ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-[#232b36] border-[#232b36] text-gray-300'} hover:border-cyan-400`}
                    onClick={() => setExpire(opt.value)}
                  >
                    {expire === opt.value ? '✓ ' : ''}{opt.label}
                  </button>
                ))}
                {/* 上传进度条 */}
                {pending && files.length > 0 && (
                  <div className="w-full mb-2">
                    <div className="w-full h-3 bg-gray-700 rounded overflow-hidden animate-pulse">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${totalProgress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1 text-center">{totalProgress}%（{totalProgress === 100 ? '全部完成' : '上传中...'}）</div>
                  </div>
                )}
                {files.length > 0 && (
                  <div className="w-full flex flex-wrap gap-2 mt-2">
                    {files.slice(0, 30).map((file, idx) => (
                      <div key={idx} className={`relative flex flex-col items-center border rounded p-2 bg-[#232b36] ${selected.includes(file.name) ? 'ring-2 ring-cyan-400 border-cyan-400' : ''}`}>
                        <button
                          className="absolute -top-2 -right-2 w-6 h-6 bg-[#232b36] text-gray-400 hover:text-red-400 rounded-full flex items-center justify-center shadow"
                          type="button"
                          title="移除"
                          onClick={() => handleRemoveFile(idx)}
                        >×</button>
                        <img src={URL.createObjectURL(file)} alt="预览" className="w-16 h-16 object-cover rounded mb-1" onClick={() => setSelected([...selected, file.name])} />
                        <span className="text-xs break-all max-w-[80px] text-gray-300">{file.name}</span>
                        {uploadingIdx.includes(idx) && <span className="text-xs text-blue-400 mt-1">上传中...</span>}
                        {failedIdx.includes(idx) && <span className="text-xs text-red-400 mt-1">失败</span>}
                      </div>
                    ))}
                    {files.length > 30 && (
                      <div className="flex items-center justify-center w-16 h-16 bg-[#232b36] rounded text-cyan-400 text-lg font-bold">+{files.length - 30}</div>
                    )}
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
                <h2 className="text-xl sm:text-2xl font-semibold mb-4">图库</h2>
                {/* 筛选栏 */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {tagOptions.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className={`px-3 py-1 rounded-lg font-medium text-sm transition border-2 ${tagFilter === tag ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-[#232b36] border-[#232b36] text-gray-300'} hover:border-cyan-400`}
                      onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {/* 批量操作栏 */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-lg font-medium text-sm transition border-2 ${selectMode ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-[#232b36] border-[#232b36] text-gray-300'} hover:border-cyan-400`}
                    onClick={() => setSelectMode(v => !v)}
                  >{selectMode ? '取消选择' : '选择'}</button>
                  {selectMode && (
                    <>
                      <button
                        type="button"
                        className={`px-3 py-1 rounded-lg font-medium text-sm transition border-2 ${selected.length === history.length && history.length > 0 ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-[#232b36] border-[#232b36] text-gray-300'} hover:border-cyan-400`}
                        onClick={() => handleSelectAll(!(selected.length === history.length && history.length > 0))}
                      >{selected.length === history.length && history.length > 0 ? '✓ ' : ''}全选</button>
                      <button className="px-3 py-1 rounded-lg font-medium text-sm transition border-2 bg-[#232b36] border-[#232b36] text-gray-100 hover:border-cyan-400 disabled:opacity-50" disabled={selected.length === 0} onClick={handleBatchDelete}>批量删除</button>
                      <button className="px-3 py-1 rounded-lg font-medium text-sm transition border-2 bg-[#232b36] border-[#232b36] text-gray-100 hover:border-cyan-400 disabled:opacity-50" disabled={selected.length === 0} onClick={handleBatchExport}>导出JSON</button>
                    </>
                  )}
                </div>
                {loading ? (
                  <p className="text-gray-500 text-center py-6">加载中...</p>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <svg className="w-16 h-16 text-gray-300 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-gray-500 text-center">暂无上传记录</p>
                  </div>
                ) : (
                  <div style={{ width: '100%', minHeight: 'calc(100vh - 200px)' }}>
                    <Masonry
                      breakpointCols={breakpointColumnsObj}
                      className="my-masonry-grid"
                      columnClassName="my-masonry-grid_column"
                    >
                      {displayItems.map(renderMasonryItem)}
                    </Masonry>
                    {isLoadingMore && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '16px 0' }}>
                        {Array.from({ length: 4 }, (_, i) => <SkeletonItem key={'more-' + i} />)}
                      </div>
                    )}
                    {hasMore && !isLoadingMore && (
                      <div style={{textAlign:'center',padding:'16px'}}>
                        <button
                          style={{
                            background: '#22d3ee', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 32px', fontSize: 16, cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 8px #22d3ee33', marginRight: 16
                          }}
                          onClick={() => {
                            const nextPage = page + 1;
                            setPage(nextPage);
                            fetchHistory(search, tagFilter, filenameFilter, nextPage, true);
                          }}
                        >加载更多</button>
                        <button
                          style={{
                            background: '#232b36', color: '#22d3ee', border: 'none', borderRadius: 8, padding: '8px 32px', fontSize: 16, cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 8px #22d3ee33'
                          }}
                          onClick={() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >回到顶部</button>
                      </div>
                    )}
                    {!hasMore && history.length > 0 && (
                      <div style={{textAlign:'center',color:'#888',padding:'12px'}}>
                        没有更多了
                        <button
                          style={{
                            marginLeft: 24,
                            background: '#232b36', color: '#22d3ee', border: 'none', borderRadius: 8, padding: '8px 32px', fontSize: 16, cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 8px #22d3ee33'
                          }}
                          onClick={() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >回到顶部</button>
                      </div>
                    )}
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
                  <div className="space-y-6">
                    <div className="flex gap-12 mb-2">
                      <div className="flex flex-col items-center flex-1">
                        <div className="text-sm text-gray-300 font-bold mb-1">上传总数</div>
                        <span className="text-2xl font-bold text-cyan-400">{stats.total}</span>
                      </div>
                      <div className="flex flex-col items-center flex-1">
                        <div className="text-sm text-gray-300 font-bold mb-1">空间占用</div>
                        <span className="text-2xl font-bold text-cyan-400">{(stats.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-300 font-bold mb-1">页面标题</div>
                      <div className="flex items-center">
                        <input
                          className="border rounded px-2 py-2 bg-[#232b36] text-gray-100 flex-1"
                          value={titleInput}
                          onChange={e => setTitleInput(e.target.value)}
                          placeholder="图床"
                        />
                        <button
                          className="ml-3 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700"
                          onClick={() => {
                            setPageTitle(titleInput.trim() || '图床');
                            localStorage.setItem('pageTitle', titleInput.trim() || '图床');
                          }}
                          type="button"
                        >保存</button>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-300 font-bold mb-1">网站图标</div>
                      <div className="flex items-center">
                        <input
                          type="file"
                          accept="image/x-icon,.ico,image/svg+xml,.svg,image/png,.png,image/jpeg,.jpg,.jpeg,image/gif,.gif,image/bmp,.bmp,image/webp,.webp"
                          onChange={e => setFaviconFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="favicon-upload"
                        />
                        <button
                          type="button"
                          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-cyan-700 mr-3"
                          onClick={() => document.getElementById('favicon-upload')?.click()}
                        >选择文件</button>
                        <span className="text-xs text-gray-400 truncate max-w-[120px] inline-block align-middle">{faviconFile?.name || ''}</span>
                        <button
                          className="ml-3 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700"
                          onClick={async () => {
                            if (faviconFile) {
                              const reader = new FileReader();
                              reader.onload = () => {
                                if (typeof reader.result === 'string') {
                                  setFaviconUrl(reader.result);
                                  localStorage.setItem('faviconUrl', reader.result);
                                }
                              };
                              reader.readAsDataURL(faviconFile);
                            }
                          }}
                          type="button"
                          disabled={!faviconFile}
                        >保存</button>
                      </div>
                    </div>
                    <div className="mt-6">
                      <div className="text-sm text-gray-300 mb-1">最大并发上传数（1~5，建议3）：</div>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={maxConcurrentUploads}
                        onChange={e => {
                          setMaxConcurrentUploads(Math.max(1, Math.min(5, Number(e.target.value))));
                          localStorage.setItem('maxConcurrentUploads', String(Math.max(1, Math.min(5, Number(e.target.value)))));
                        }}
                        className="border rounded px-2 py-1 bg-[#232b36] text-gray-100 w-16"
                      />
                    </div>
                    <div className="flex justify-end pt-4 gap-4">
                      <button
                        className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-red-600"
                        onClick={handleLogout}
                      >退出登录</button>
                      <button
                        className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700"
                        onClick={handleDeduplicate}
                      >去重</button>
                    </div>
                    {/* 在设置页“去重”按钮下方显示进度条 */}
                    {dedupProgress > 0 && (
                      <div className="w-full mb-2">
                        <div className="w-full h-3 bg-gray-700 rounded overflow-hidden animate-pulse">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${dedupProgress}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-400 mt-1 text-center">{dedupProgress}%（去重中...）</div>
                      </div>
                    )}
                  </div>
                ) : <div className="text-gray-400">加载中...</div>}
              </div>
            </div>
          )}
        </div>
      {/* 图片详情弹窗 */}
      {modalOpen && modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closeModal}>
          <div className="bg-[#181f29] rounded-2xl shadow-2xl p-6 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-2 right-2 text-gray-400 hover:text-cyan-400 text-2xl" onClick={closeModal}>×</button>
            <div style={{minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'}}>
              {/* 加载动画，未加载完时显示 */}
              {!imgInfo.width && !imgInfo.size && (
                <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', zIndex: 2}} className="w-full h-80 flex items-center justify-center bg-[#232b36] animate-pulse rounded">
                  <span className="text-gray-400">图片加载中...</span>
                </div>
              )}
              {/* 加载失败时显示提示 */}
              {imgInfo.size === -1 && (
                <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', zIndex: 3, background: '#232b36', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12}}>
                  <span className="text-red-400">图片加载失败</span>
                </div>
              )}
              <img
                src={`/api/get_photo/${modalItem.file_id}`}
                alt="大图"
                loading="lazy"
                className="w-full rounded mb-4 bg-[#232b36]"
                style={{maxHeight: 320, objectFit: 'contain', opacity: imgInfo.width ? 1 : 0, transition: 'opacity 0.3s'}}
                onLoad={e => {
                  const target = e.currentTarget as HTMLImageElement | null;
                  if (target && target.naturalWidth && target.naturalHeight) {
                    setImgInfo(prev => ({ ...prev, width: target.naturalWidth, height: target.naturalHeight }));
                  }
                }}
                onError={e => {
                  setImgInfo(prev => ({ ...prev, size: -1 }));
                  e.currentTarget.src = 'https://via.placeholder.com/400x300?text=加载失败';
                }}
              />
            </div>
            <div className="space-y-2">
              <div className="text-base font-bold text-gray-100 truncate">{modalItem.filename || modalItem.file_id}</div>
              <div className="text-xs text-gray-400">上传时间：{new Date(modalItem.created_at).toLocaleString()}</div>
              <div className="text-xs text-gray-400">标签：{modalItem.tags || '-'}</div>
              <div className="text-xs text-gray-400">尺寸：{imgInfo.width} × {imgInfo.height}</div>
              <div className="text-xs text-gray-400">大小：{imgInfo.size > 0 ? (imgInfo.size > 1024*1024 ? (imgInfo.size/1024/1024).toFixed(2)+' MB' : (imgInfo.size/1024).toFixed(1)+' KB') : '-'}</div>
              {modalItem.short_code && (
                <>
                  <div className="text-xs text-gray-400">直链：
                    <a href={`${SHORTLINK_DOMAIN || window.location.origin}/img/${modalItem.short_code}`} target="_blank" rel="noopener" className="text-cyan-400 underline break-all ml-1">{`${SHORTLINK_DOMAIN || window.location.origin}/img/${modalItem.short_code}`}</a>
                    <button className="ml-2 px-2 py-1 text-xs bg-[#232b36] rounded hover:bg-cyan-700 text-cyan-300" onClick={()=>handleCopy(`${SHORTLINK_DOMAIN || window.location.origin}/img/${modalItem.short_code}`)}>复制</button>
                  </div>
                  <div className="text-xs text-gray-400">Markdown：
                    <input className="border px-1 py-0.5 text-xs w-60 bg-[#232b36] text-gray-100 ml-1" value={`![](${SHORTLINK_DOMAIN || window.location.origin}/img/${modalItem.short_code})`} readOnly />
                    <button className="ml-2 px-2 py-1 text-xs bg-[#232b36] rounded hover:bg-cyan-700 text-cyan-300" onClick={()=>handleCopy(`![](${SHORTLINK_DOMAIN || window.location.origin}/img/${modalItem.short_code})`)}>复制</button>
                  </div>
                  <div className="text-xs text-gray-400">HTML：
                    <input className="border px-1 py-0.5 text-xs w-60 bg-[#232b36] text-gray-100 ml-1" value={`<img src="${SHORTLINK_DOMAIN || window.location.origin}/img/${modalItem.short_code}" />`} readOnly />
                    <button className="ml-2 px-2 py-1 text-xs bg-[#232b36] rounded hover:bg-cyan-700 text-cyan-300" onClick={()=>handleCopy(`<img src="${SHORTLINK_DOMAIN || window.location.origin}/img/${modalItem.short_code}" />`)}>复制</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// fetch工具函数，自动处理token续期
async function fetchWithAuth(url: string, options: any = {}) {
  const token = localStorage.getItem('jwt_token') || '';
  options.headers = options.headers || {};
  options.headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, options);
  const refreshedToken = res.headers.get('X-Refreshed-Token');
  if (refreshedToken) {
    localStorage.setItem('jwt_token', refreshedToken);
  }
  return res;
}

export default App;
