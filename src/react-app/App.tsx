import React, { useState, useRef, useEffect } from 'react';
import SparkMD5 from 'spark-md5';
import { AnimatePresence, motion } from 'framer-motion';

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

// 面包屑导航组件（加卡片框样式）
function Breadcrumbs({ folder, onChange }: { folder: string; onChange: (f: string) => void }) {
  // 修正路径分割，避免出现 //
  const parts = folder.replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').split('/').filter(Boolean);
  const paths = parts.map((_, i) => '/' + parts.slice(0, i + 1).join('/') + '/');
  return (
    <div className="bg-[#232b36] rounded-lg px-4 py-2 my-1 flex items-center border border-[#232b36]">
      {parts.length === 0 ? (
        <button className="hover:text-cyan-400" onClick={() => onChange('/')}>/</button>
      ) : null}
      {parts.map((part, idx) => (
        <span key={idx} className="flex items-center" style={{ marginLeft: idx === 0 ? 0 : 4 }}>
          <span>/</span>
          <button
            className="hover:text-cyan-400 ml-1"
            onClick={() => onChange(paths[idx])}
            style={{ fontWeight: idx === parts.length - 1 ? 'bold' : undefined }}
          >{part}</button>
        </span>
      ))}
    </div>
  );
}

// 升级: 多级文件夹树选择器弹窗
function buildFolderTree(folders: string[]): any {
  const root: any = {};
  for (const path of folders) {
    const parts = path.split('/').filter(Boolean);
    let node = root;
    for (const part of parts) {
      if (!node[part]) node[part] = {};
      node = node[part];
    }
  }
  return root;
}
function FolderTree({ tree, path, selected, onSelect }: { tree: any; path: string; selected: string; onSelect: (p: string) => void }) {
  return (
    <ul className="pl-2">
      {Object.keys(tree).map(key => {
        const fullPath = path + key + '/';
        return (
          <li key={fullPath} className="mb-1">
            <button
              className={`text-left px-2 py-1 rounded w-full ${selected === fullPath ? 'bg-cyan-600 text-white' : 'bg-[#232b36] text-cyan-400 hover:bg-cyan-700'}`}
              onClick={() => onSelect(fullPath)}
            >{key}</button>
            {Object.keys(tree[key]).length > 0 && (
              <FolderTree tree={tree[key]} path={fullPath} selected={selected} onSelect={onSelect} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
function FolderSelectModal({ open, onClose, onConfirm, folders, currentFolder }: { open: boolean; onClose: () => void; onConfirm: (folder: string) => void; folders: string[]; currentFolder: string }) {
  const [input, setInput] = React.useState(currentFolder || '/');
  const [error, setError] = React.useState('');
  const [selected, setSelected] = React.useState(currentFolder || '/');
  React.useEffect(() => { setInput(selected); }, [selected]);
  function handleConfirm() {
    let value = input.trim();
    // 自动补全结尾 /
    if (!value.endsWith('/')) value += '/';
    // 校验
    if (!/^\/(?:[\u4e00-\u9fa5a-zA-Z0-9_]+\/)*$/.test(value)) {
      setError('文件夹路径仅允许中英文、数字、下划线，且以/开头/结尾');
      return;
    }
    setError('');
    onConfirm(value);
  }
  const [visible, setVisible] = useState(open);
  useEffect(() => {
    if (open) setVisible(true);
  }, [open]);
  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      onClose();
    }, 200); // 与动画时长一致
  };
  if (!open && !visible) return null;
  const tree = buildFolderTree(folders);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
      <div className="bg-[#181f29] rounded-2xl shadow-2xl p-6 w-full max-w-2xl relative flex flex-col sm:flex-row gap-6" onClick={e => e.stopPropagation()}>
        <div className="min-w-[180px] max-h-72 overflow-y-auto border-r border-[#232b36] pr-4">
          <div className="mb-2 text-xs text-gray-400">当前位置：</div>
          <FolderTree tree={tree} path="/" selected={selected} onSelect={p => { setSelected(p); setInput(p); }} />
        </div>
        <div className="flex-1 flex flex-col">
          <div className="mb-4 text-lg font-bold text-cyan-400">选择或输入文件夹</div>
          <input
            className="w-full border rounded px-3 py-2 bg-[#232b36] text-gray-100 focus:outline-none focus:border-cyan-400 mb-2"
            value={input}
            onChange={e => { setInput(e.target.value.replace(/\s/g, '')); setSelected(e.target.value.replace(/\s/g, '')); }}
            placeholder="/目标/文件夹/"
          />
          {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
          <button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 px-4 rounded-md transition duration-300 mt-4" onClick={handleConfirm}>确定</button>
        </div>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
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
  const [selected, setSelected] = useState<string[]>([]); // 多选 file_id
  const [tagFilter, setTagFilter] = useState('');
  const [filenameFilter] = useState('');
  const [files, setFiles] = useState<File[]>([]); // 待上传文件队列
  const [stats, setStats] = useState<{ total: number; size: number; hot: any[] }>({ total: 0, size: 0, hot: [] });
  const [dragActive, setDragActive] = useState(false);
  type TabType = 'upload' | 'gallery' | 'settings';
  const [tab, setTab] = useState<TabType>('upload');
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

  // 在 AppContent 组件顶部 useState 区域添加：
  const [bgImageFile, setBgImageFile] = useState<File|null>(null);
  const [bgImageUrl, setBgImageUrl] = useState<string>(() => localStorage.getItem('siteBgImage') || '');
  const [siteOpacity, setSiteOpacity] = useState<string>(() => localStorage.getItem('siteOpacity') || '1');

  // 新增上传目标文件夹状态
  const [uploadFolder, setUploadFolder] = useState<string>("/");
  const [uploadFolderModalOpen, setUploadFolderModalOpen] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string>("/");
  const [galleryFolderModalOpen, setGalleryFolderModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);

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

  // 获取图片，支持分页加载更多
  const LIMIT = 50;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const galleryCache = React.useRef<{ [key: string]: any[] }>({});
  const fetchImages = async (searchVal = '', tagVal = '', filenameVal = '', pageNum = 1, append = false, folderPath = '') => {
    const cacheKey = `${searchVal}|${tagVal}|${filenameVal}|${pageNum}|${folderPath}`;
    if (galleryCache.current[cacheKey]) {
      if (append) {
        setHistory(prev => [...prev, ...galleryCache.current[cacheKey]]);
      } else {
        setHistory(galleryCache.current[cacheKey]);
      }
      setHasMore(galleryCache.current[cacheKey].length === LIMIT);
      return;
    }
    if (!isAuthed) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchVal) params.append('search', searchVal);
      if (tagVal) params.append('tag', tagVal);
      if (filenameVal) params.append('filename', filenameVal);
      params.append('page', String(pageNum));
      params.append('limit', String(LIMIT));
      if (folderPath) params.append('folder', folderPath);
      const response = await fetchWithAuth(`/api/history?${params.toString()}`);
      if (!response.ok) throw new Error('获取图片失败');
      const data = await response.json();
      if (data.status === 'success') {
        if (append) {
          setHistory(prev => [...prev, ...data.data]);
        } else {
          setHistory(data.data);
        }
        galleryCache.current[cacheKey] = data.data;
        // 提取所有图片的标签
        const allTags = data.data
          .map((item: any) => (item.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean))
          .flat();
        const uniqueTags = Array.from(new Set(allTags)) as string[];
        setTagOptions(uniqueTags.length > 0 ? uniqueTags : ['默认']);
        setHasMore(data.data.length === LIMIT);
      } else {
        setToast({ message: data.message || '加载图片失败', type: 'error' });
        setHasMore(true);
      }
    } catch (error) {
      setToast({ message: '加载图片失败，请重试', type: 'error' });
      setHasMore(true);
    } finally {
      setLoading(false);
    }
  };

  // useEffect: 初始化和筛选变化时重置分页
  useEffect(() => {
    if (!isAuthed) return;
    setPage(1);
    setHasMore(true);
    fetchImages(search, tagFilter, filenameFilter, 1, false, currentFolder);
  }, [isAuthed, search, tagFilter, filenameFilter, currentFolder]);

  // 加载更多按钮事件
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchImages(search, tagFilter, filenameFilter, nextPage, true, currentFolder);
  };

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
    let retry = 0;
    while (retry < 3) {
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
                // 检查是否是 Too Many Requests
                const match = /Too Many Requests: retry after (\d+)/.exec(res.message || '');
                if (match) {
                  const waitSec = parseInt(match[1], 10);
                  setToast({ message: `限流，等待${waitSec}秒后重试...`, type: 'error' });
                  setTimeout(() => { retry++; resolve(); }, waitSec * 1000);
                  return;
                }
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
        break; // 成功或非限流错误时跳出循环
      } catch (err) {
        if (retry >= 3) throw err;
        // 其它错误直接抛出
        throw err;
      }
    }
  };

  // 3. 优化 handleUploadAll，上传全部完成后只刷新一次图片列表
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
    // 上传全部完成后只刷新一次图片列表
    fetchImages(search, tagFilter, filenameFilter, 1, false, uploadFolder);
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
    // 获取原图尺寸
    const img = new window.Image();
    img.onload = () => {
      setImgInfo(prev => ({ ...prev, width: img.naturalWidth, height: img.naturalHeight }));
    };
    img.src = `/api/get_photo/${modalItem.file_id}`;
    // 获取原图大小（HEAD 请求）
    fetch(`/api/get_photo/${modalItem.file_id}`, { method: 'HEAD' })
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

  // ProgressiveImage 组件：支持 onLoad/onError 回调
  function ProgressiveImage({
    file_id, alt, className, style, onLoad, onError, onOriginalLoad
  }: {
    file_id: string,
    alt?: string,
    className?: string,
    style?: React.CSSProperties,
    onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void,
    onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void,
    onOriginalLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  }) {
    const [src, setSrc] = React.useState(`/api/get_photo/${file_id}?thumb=1`);
    const loadedRef = React.useRef(false);
    React.useEffect(() => {
      loadedRef.current = false;
      setSrc(`/api/get_photo/${file_id}?thumb=1`);
      const img = new window.Image();
      img.src = `/api/get_photo/${file_id}`;
      img.onload = () => {
        if (!loadedRef.current) {
          setSrc(`/api/get_photo/${file_id}`);
          loadedRef.current = true;
        }
      };
      return () => { loadedRef.current = true; };
    }, [file_id]);
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        loading="lazy"
        onLoad={e => {
          if (src.endsWith('?thumb=1')) {
            if (onLoad) onLoad(e); // 缩略图加载
          } else {
            if (onOriginalLoad) onOriginalLoad(e); // 原图加载
          }
        }}
        onError={e => {
          if (onError) onError(e);
          (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/200?text=加载失败';
        }}
      />
    );
  }

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
        <ProgressiveImage
          file_id={img.file_id}
          alt={img.filename || img.file_id}
          style={{ width: '100%', display: 'block', borderRadius: 12, maxHeight: 320, objectFit: 'cover' }}
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

  // Masonry items准备 - 修复骨架屏逻辑
  const displayItems = loading && history.length === 0
    ? Array.from({ length: 20 }, (_, i) => ({ skeleton: true, id: 'skeleton-' + i }))
    : history;

  // 添加加载更多时的骨架屏
  const loadingMoreItems = loading && history.length > 0
    ? Array.from({ length: 8 }, (_, i) => ({ skeleton: true, id: 'loading-more-' + i }))
    : [];

  // 在 AppContent 组件内部添加 handleDeduplicate 函数（递归所有文件夹）
  const handleDeduplicate = async (selectedIds?: string[]) => {
    setToast({ message: '正在递归获取所有图片...', type: 'info' });
    setDedupProgress(0);
    // 1. 获取所有文件夹
    const resFolders = await fetchWithAuth('/api/folders');
    const dataFolders = await resFolders.json();
    const allFolders: string[] = dataFolders.folders || ['/'];
    // 2. 递归拉取所有图片
    type ImageItem = { file_id: string; filename?: string };
    let allImages: ImageItem[] = [];
    for (const folder of allFolders) {
      let page = 1, hasMore = true;
      const pageSize = 100;
      while (hasMore) {
        const res = await fetchWithAuth(`/api/history?page=${page}&limit=${pageSize}&folder=${encodeURIComponent(folder)}`);
        const data = await res.json();
        if (data.status === 'success') {
          allImages = allImages.concat(data.data as ImageItem[]);
          hasMore = (data.data as ImageItem[]).length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
    }
    // 3. 只对选中的图片去重（如果有传 selectedIds）
    if (selectedIds && selectedIds.length > 0) {
      allImages = allImages.filter(img => selectedIds.includes(img.file_id));
    }
    // 4. 并发下载所有图片并计算 hash
    const hashMap: Record<string, ImageItem[]> = {};
    const toDelete: string[] = [];
    const concurrency = 6;
    let finished = 0;
    const total = allImages.length;
    const tasks: (() => Promise<void>)[] = allImages.map((img) => async () => {
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
    // 5. 分组去重，保留每组第一个，其余加入待删除
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
    // 6. 批量删除
    const res = await fetchWithAuth('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt_token') || ''}` },
      body: JSON.stringify({ ids: toDelete })
    });
    const data = await res.json();
    setDedupProgress(0);
    if (data.status === 'success') {
      setToast({ message: `去重完成，删除了${toDelete.length}条重复图片`, type: 'success' });
      fetchImages(search, tagFilter, filenameFilter, 1, false, currentFolder);
    } else {
      setToast({ message: '去重失败', type: 'error' });
    }
  };

  // 新增dedupProgress状态
  const [dedupProgress, setDedupProgress] = useState(0);

  // 待上传图片缓存机制
  useEffect(() => {
    // 保存到localStorage
    if (files.length > 0) {
      const cache = files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        lastModified: f.lastModified,
        data: ''
      }));
      // 读取文件内容为base64
      Promise.all(files.map(f => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result || '');
        reader.readAsDataURL(f);
      }))).then(datas => {
        for (let i = 0; i < cache.length; i++) cache[i].data = datas[i] as string;
        localStorage.setItem('upload_files_cache', JSON.stringify(cache));
      });
    } else {
      localStorage.removeItem('upload_files_cache');
    }
  }, [files]);

  useEffect(() => {
    // 页面加载时恢复缓存
    if (files.length === 0) {
      const cacheStr = localStorage.getItem('upload_files_cache');
      if (cacheStr) {
        try {
          const cache = JSON.parse(cacheStr);
          if (Array.isArray(cache) && cache.length > 0) {
            const restored = cache.map((item: any) => {
              const arr = atob(item.data.split(',')[1]);
              const u8arr = new Uint8Array(arr.length);
              for (let i = 0; i < arr.length; i++) u8arr[i] = arr.charCodeAt(i);
              return new File([u8arr], item.name, { type: item.type, lastModified: item.lastModified });
            });
            setFiles(restored);
          }
        } catch {}
      }
    }
  }, []);

  // 新增批量移动/复制逻辑
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [allFolders, setAllFolders] = useState<string[]>([]);

  async function handleCopyImages(folder: string) {
    setCopyModalOpen(false);
    if (!folder || selected.length === 0) return;
    await fetchWithAuth('/api/copy_images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selected, target_folder: folder })
    });
    setSelected([]);
    fetchImages(search, tagFilter, filenameFilter, 1, false, currentFolder);
  }

  // 获取所有文件夹列表
  useEffect(() => {
    async function fetchFolders() {
      const res = await fetchWithAuth('/api/folders');
      const data = await res.json();
      if (data.status === 'success') setAllFolders(data.folders);
    }
    fetchFolders();
  }, [currentFolder]);

  // 在 AppContent 组件内，galleryFolderModalOpen、moveModalOpen、copyModalOpen 定义附近，补充 handleMoveImages 函数：
  async function handleMoveImages(folder: string) {
    setMoveModalOpen(false);
    if (!folder || selected.length === 0) return;
    await fetchWithAuth('/api/move_images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selected, target_folder: folder })
    });
    setSelected([]);
    fetchImages(search, tagFilter, filenameFilter, 1, false, currentFolder);
  }

  // useEffect: 初始化和筛选变化时重置分页
  useEffect(() => {
    if (!isAuthed) return;
    setPage(1);
    setHasMore(true);
    fetchImages(search, tagFilter, filenameFilter, 1, false, currentFolder); 
  }, [isAuthed, search, tagFilter, filenameFilter, currentFolder]);

  // 在 useEffect 区域添加：
  useEffect(() => {
    document.body.style.backgroundImage = bgImageUrl ? `url('${bgImageUrl}')` : '';
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundPosition = 'center';
    document.body.style.opacity = siteOpacity;
  }, [bgImageUrl, siteOpacity]);

  // 进入设置页时拉取后端设置
  useEffect(() => {
    if (tab === 'settings') {
      fetchWithAuth('/api/settings').then(async res => {
        const data = await res.json();
        if (data.status === 'success') {
          setSettings(data);
          // 同步到本地表单
          if (data.pageTitle) setTitleInput(data.pageTitle);
          if (data.maxConcurrentUploads) setMaxConcurrentUploads(Number(data.maxConcurrentUploads));
        }
      });
    }
  }, [tab]);

  return (
    <div className="flex flex-col min-h-screen bg-[#10151b]">
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
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '' })} />
      <div className="flex-1 min-h-0 bg-[#10151b]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.3 }}
            style={{ width: '100%' }}
          >
            {tab === 'gallery' && (
              <div
                className="card card-hover mx-auto mt-8"
                style={{ width: '90%', display: 'flex', flexDirection: 'column' }}
              >
                <div className="w-full px-4">
                  {/* 顶部操作区，sticky固定 */}
                  <div className="sticky top-16 z-20 bg-[#181f29]">
                    <div className="mt-2 sm:mt-0 max-w-7xl w-full p-1 mx-auto">
                      {/* 面包屑导航 + 上一级按钮 + 选择文件夹按钮 */}
                      <div className="flex items-center justify-between mb-4 bg-[#232b36] rounded-lg px-4 shadow border border-[#232b36]" style={{ minHeight: 40 }}>
                        <div className="flex items-center h-full">
                          <Breadcrumbs folder={currentFolder} onChange={f => {
                            setCurrentFolder(f);
                            setPage(1);
                            setHasMore(true);
                            fetchImages(search, tagFilter, filenameFilter, 1, false, f);
                          }} />
                          {/* 上一级按钮，仅非根目录时显示 */}
                          {currentFolder !== '/' && (
                            <button
                              className="ml-2 px-3 py-1 rounded bg-cyan-600 text-white hover:bg-cyan-700"
                              onClick={() => {
                                let parent = currentFolder.replace(/\/+$/, '').split('/');
                                parent.pop();
                                const parentPath = parent.length > 1 ? parent.join('/') + '/' : '/';
                                setCurrentFolder(parentPath);
                                setPage(1);
                                setHasMore(true);
                                fetchImages(search, tagFilter, filenameFilter, 1, false, parentPath);
                              }}
                            >上一级</button>
                          )}
            </div>
                        <button
                          className="px-3 py-1 rounded-lg font-medium text-sm transition border-2 bg-cyan-600 text-white hover:bg-cyan-700 ml-2"
                          style={{ minWidth: 100 }}
                          onClick={() => setGalleryFolderModalOpen(true)}
                        >选择文件夹</button>
            </div>
                      {/* 文件夹选择弹窗（与上传页一致，独立控制） */}
                      <FolderSelectModal open={galleryFolderModalOpen} onClose={() => setGalleryFolderModalOpen(false)} onConfirm={f => { setCurrentFolder(f); setGalleryFolderModalOpen(false); setPage(1); setHasMore(true); fetchImages(search, tagFilter, filenameFilter, 1, false, f); }} folders={allFolders} currentFolder={currentFolder} />
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
                      {/* 在sticky操作区的批量操作栏前始终显示"选择/取消选择"按钮 */}
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          className="px-3 py-1 rounded-lg font-medium text-sm transition border-2 bg-[#232b36] border-[#232b36] text-cyan-400 hover:border-cyan-400 mr-2"
                          disabled={history.length === 0}
                          onClick={() => {
                            if (window.confirm('将对所有图片去重，是否继续？')) {
                              handleDeduplicate();
                            }
                          }}
                        >去重</button>
                        <button
                          type="button"
                          className={`px-3 py-1 rounded-lg font-medium text-sm transition border-2 ${selectMode ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-[#232b36] border-[#232b36] text-gray-300'} hover:border-cyan-400 mr-2`}
                          onClick={() => setSelectMode(v => !v)}
                        >{selectMode ? '取消选择' : '选择'}</button>
                        {selectMode && <>
                          <button className="px-3 py-1 rounded-lg font-medium text-sm transition border-2 bg-[#232b36] border-[#232b36] text-cyan-400 hover:border-cyan-400 mr-2" onClick={() => handleSelectAll(!(selected.length === history.length && history.length > 0))}>{selected.length === history.length && history.length > 0 ? '✓ ' : ''}全选</button>
                          <button className="px-3 py-1 rounded-lg font-medium text-sm transition border-2 bg-[#232b36] border-[#232b36] text-gray-100 hover:border-cyan-400 disabled:opacity-50 mr-2" disabled={selected.length === 0} onClick={handleBatchDelete}>删除</button>
                          <button className="px-3 py-1 rounded-lg font-medium text-sm transition border-2 bg-[#232b36] border-[#232b36] text-gray-100 hover:border-cyan-400 disabled:opacity-50 mr-2" disabled={selected.length === 0} onClick={() => setCopyModalOpen(true)} >复制</button>
                          <button className="px-3 py-1 rounded-lg font-medium text-sm transition border-2 bg-[#232b36] border-[#232b36] text-gray-100 hover:border-cyan-400 disabled:opacity-50 mr-2" disabled={selected.length === 0} onClick={() => setMoveModalOpen(true)}>移动</button>
                          <button className="px-3 py-1 rounded-lg font-medium text-sm transition border-2 bg-[#232b36] border-[#232b36] text-gray-100 hover:border-cyan-400 disabled:opacity-50 mr-2" disabled={selected.length === 0} onClick={handleBatchExport}>导出JSON</button>
                        </>}
                      </div>
                    </div>
                  </div>
                  {/* 图片区，独立滚动 */}
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    {/* 分割线和提示 */}
                    <div className="my-4 flex items-center">
                      <div className="flex-1 border-t border-gray-600"></div>
                    </div>
                    <div className="w-full">
                      {/* 当前文件夹下的子文件夹 */}
                      {(() => {
                        const subFolders = allFolders.filter(f => {
                          if (!f.startsWith(currentFolder) || f === currentFolder) return false;
                          const rest = f.slice(currentFolder.length);
                          return rest && !rest.slice(0, -1).includes('/');
                        });
                        if (subFolders.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1 mb-4">
                            {subFolders.map(folder => (
                              <div
                                key={folder}
                                className="card card-hover flex items-center justify-center cursor-pointer w-40 h-32 bg-[#232b36] hover:bg-[#232b36]/80 border border-[#232b36] rounded-lg shadow"
                                onClick={() => {
                                  setCurrentFolder(folder);
                                  setPage(1);
                                  setHasMore(true);
                                  fetchImages(search, tagFilter, filenameFilter, 1, false, folder);
                                }}
                              >
                                <span className="text-3xl mr-2">📁</span>
                                <span className="truncate">{folder.replace(currentFolder, '').replace(/\/$/, '')}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      {/* 网格图片展示区 */}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-1">
                        {displayItems.map(img =>
                          'folder' in img ? (img.folder === currentFolder ? renderMasonryItem(img) : null) : renderMasonryItem(img)
                        )}
                        {loadingMoreItems.map(renderMasonryItem)}
                      </div>
                      {loading && history.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '16px 0' }}>
                          {Array.from({ length: 4 }, (_, i) => <SkeletonItem key={'more-' + i} />)}
                        </div>
                      ) : null}
                      {hasMore && !loading && (
                        <div style={{textAlign:'center',padding:'16px'}}>
                          <button
                            style={{
                              background: '#22d3ee', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 32px', fontSize: 16, cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 8px #22d3ee33', marginRight: 16
                            }}
                            onClick={handleLoadMore}
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
                    </div>
                  </div>
                  {/* 批量复制弹窗 */}
                  <FolderSelectModal open={copyModalOpen} onClose={() => setCopyModalOpen(false)} onConfirm={handleCopyImages} folders={allFolders} currentFolder={currentFolder} />
                  {/* 批量移动弹窗 */}
                  <FolderSelectModal open={moveModalOpen} onClose={() => setMoveModalOpen(false)} onConfirm={handleMoveImages} folders={allFolders} currentFolder={currentFolder} />
                </div>
              </div>
            )}
            {tab === 'upload' && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
                <div
                  className={`card card-hover w-full max-w-2xl mx-auto${dragActive ? ' ring-4 ring-cyan-400 rounded-2xl' : ''}`}
                style={{ minWidth: '33vw', minHeight: '25vw' }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                  {/* 上传卡片内容... */}
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div className="space-y-4 w-full h-full flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-4 bg-[#232b36] rounded-lg px-4 shadow border border-[#232b36] min-h-[40px] w-full">
                      <div className="flex items-center h-full w-full">
                        <Breadcrumbs folder={uploadFolder} onChange={f => setUploadFolder(f)} />
                      </div>
                      <button
                        className="px-3 py-1 rounded-lg font-medium text-sm transition border-2 bg-cyan-600 text-white hover:bg-cyan-700 ml-2"
                        style={{ minWidth: 100 }}
                        onClick={() => setUploadFolderModalOpen(true)}
                      >选择文件夹</button>
                    </div>
                    <FolderSelectModal open={uploadFolderModalOpen} onClose={() => setUploadFolderModalOpen(false)} onConfirm={f => { setUploadFolder(f); setUploadFolderModalOpen(false); }} folders={allFolders} currentFolder={uploadFolder} />
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
                    <div className="flex flex-wrap gap-2 w-full">
                      {/* 标签按钮等内容 */}
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
                    <div className="flex items-center gap-2 w-full">
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
                    </div>
                    <form className="space-y-4 w-full h-full flex flex-col justify-center" onSubmit={e => { e.preventDefault(); handleUploadAll(); }}>
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
                    </form>
                    {/* 待上传图片渲染区块... */}
                    {files.length > 0 && (
                      <div className="w-full flex flex-wrap gap-2 mt-2">
                        {files.slice(0, 30).map((file, idx) => (
                          <div key={file.name + file.size + idx} className="relative flex flex-col items-center border rounded p-2 bg-[#232b36]">
                            <button
                              className="absolute -top-2 -right-2 w-6 h-6 bg-[#232b36] text-gray-400 hover:text-red-400 rounded-full flex items-center justify-center shadow"
                              type="button"
                              title="移除"
                              onClick={() => handleRemoveFile(idx)}
                            >×</button>
                            <span className="text-xs break-all max-w-[80px] text-gray-300">{file.name}</span>
                            {uploadingIdx.includes(idx) && <span className="text-xs text-blue-400 mt-1">上传中</span>}
                            {failedIdx.includes(idx) && <span className="text-xs text-red-400 mt-1">失败</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
            {tab === 'settings' && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
                <div className={`card card-hover w-full max-w-2xl mx-auto`} style={{ minWidth: '33vw', minHeight: '25vw' }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <h2 className="text-lg font-bold mb-4 text-cyan-400 w-full">系统设置</h2>
                    <div className="space-y-6 w-full">
                      <div className="flex gap-12 mb-2 w-full">
                        <div className="flex flex-col items-center flex-1">
                          <div className="text-sm text-gray-300 font-bold mb-1">上传总数</div>
                          <span className="text-2xl font-bold text-cyan-400">{stats.total ?? ''}</span>
                        </div>
                        <div className="flex flex-col items-center flex-1">
                          <div className="text-sm text-gray-300 font-bold mb-1">空间占用</div>
                          <span className="text-2xl font-bold text-cyan-400">{stats.size ? (stats.size / 1024 / 1024).toFixed(2) : ''} MB</span>
                        </div>
                      </div>
                      <div className="w-full">
                        <div className="text-sm text-gray-300 font-bold mb-1">页面标题</div>
                        <div className="flex items-center w-full">
                          <input
                            className="border rounded px-2 py-2 bg-[#232b36] text-gray-100 flex-1 w-full"
                            value={titleInput ?? settings?.pageTitle ?? ''}
                            onChange={e => setTitleInput(e.target.value)}
                            placeholder="图床"
                          />
                          <button
                            className="ml-3 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 w-32"
                            onClick={() => {
                              setPageTitle(titleInput); // 立即更新全局页面标题
                              setSettings({ ...settings, pageTitle: titleInput.trim() });
                              localStorage.setItem('pageTitle', titleInput.trim());
                            }}
                            type="button"
                          >保存</button>
                        </div>
                      </div>
                      <div className="w-full">
                        <div className="text-sm text-gray-300 font-bold mb-1">网站图标</div>
                        <div className="flex items-center w-full">
                          <input
                            type="file"
                            accept="image/x-icon,.ico,image/svg+xml,.svg,image/png,.png,image/jpeg,.jpg,.jpeg,image/gif,.gif,image/bmp,.bmp,image/webp,.webp"
                            onChange={e => setFaviconFile(e.target.files?.[0] || null)}
                            className="hidden"
                            id="favicon-upload"
                          />
                          <button
                            type="button"
                            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-cyan-700 mr-3 w-32"
                            onClick={() => document.getElementById('favicon-upload')?.click()}
                          >选择文件</button>
                          <span className="text-xs text-gray-400 truncate max-w-[120px] inline-block align-middle">{faviconFile?.name || ''}</span>
                          <button
                            className="ml-3 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 w-32"
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
                      <div className="mt-6 w-full">
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
                          className="border rounded px-2 py-1 bg-[#232b36] text-gray-100 w-full max-w-xs"
                        />
                      </div>
                      {/* 在设置页"去重"按钮下方显示进度条 */}
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
                      {/* 新增：网站背景图设置 */}
                      <div className="w-full">
                        <div className="text-sm text-gray-300 font-bold mb-1">网站背景图</div>
                        <div className="flex items-center w-full">
                          {/* 背景图直链输入 */}
                          <input
                            type="text"
                            className="border rounded px-2 py-1 bg-[#232b36] text-gray-100 w-full max-w-xs"
                            placeholder="输入图片直链（http(s)://...）"
                            value={bgImageUrl.startsWith('data:') ? '' : bgImageUrl}
                            onChange={e => {
                              setBgImageUrl(e.target.value);
                              localStorage.setItem('siteBgImage', e.target.value);
                            }}
                          />
                          {bgImageUrl && !bgImageUrl.startsWith('data:') && (
                            <img src={bgImageUrl} alt="预览" className="ml-4 rounded shadow max-h-12" style={{maxWidth: 64}} />
                          )}
                          {/* 选择图片按钮和保存按钮 */}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => setBgImageFile(e.target.files?.[0] || null)}
                            className="hidden"
                            id="bgimg-upload"
                          />
                          <button
                            type="button"
                            className="ml-3 px-4 py-2 bg-gray-700 text-white rounded hover:bg-cyan-700 w-32"
                            onClick={() => document.getElementById('bgimg-upload')?.click()}
                          >选择图片</button>
                          <span className="text-xs text-gray-400 truncate max-w-[120px] inline-block align-middle">{bgImageFile?.name || ''}</span>
                          <button
                            className="ml-3 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 w-32"
                            onClick={async () => {
                              if (bgImageFile) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  if (typeof reader.result === 'string') {
                                    setBgImageUrl(reader.result);
                                    localStorage.setItem('siteBgImage', reader.result);
                                  }
                                };
                                reader.readAsDataURL(bgImageFile);
                              } else {
                                setBgImageUrl('');
                                localStorage.setItem('siteBgImage', '');
                              }
                            }}
                            type="button"
                            disabled={!bgImageFile && !bgImageUrl}
                          >保存</button>
                          {bgImageUrl && bgImageUrl.startsWith('data:') && (
                            <img src={bgImageUrl} alt="预览" className="ml-4 rounded shadow max-h-12" style={{maxWidth: 64}} />
                      )}
                    </div>
                      </div>
                      {/* 新增：网站透明度设置 */}
                      <div className="w-full">
                        <div className="text-sm text-gray-300 font-bold mb-1">网站透明度（0~100%）</div>
                        <div className="flex items-center w-full">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={Math.round(Number(siteOpacity) * 100)}
                            onChange={e => {
                              let v = e.target.value;
                              let percent = Math.max(0, Math.min(100, Number(v)));
                              let real = (percent / 100).toFixed(2);
                              setSiteOpacity(real);
                              localStorage.setItem('siteOpacity', real);
                            }}
                            className="w-full max-w-xs mr-4 accent-cyan-400"
                          />
                          <span className="text-gray-200 w-16 text-right">{Math.round(Number(siteOpacity) * 100)}%</span>
                        </div>
                      </div>
                      <div className="flex justify-center pt-4 w-full">
                        <button
                          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-red-600 w-32"
                          onClick={handleLogout}
                        >退出登录</button>
                      </div>
                    </div>
                </div>
              </div>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
        </div>
      {/* Modal 独立渲染，避免影响主内容区挂载和滚动 */}
      {modalOpen && (
        <ImageDetailModal
          open={modalOpen}
          item={modalItem}
          onClose={closeModal}
          imgInfo={imgInfo}
          handleCopy={handleCopy}
          images={history.filter(i => ('folder' in i ? i.folder === currentFolder : true))}
          currentIndex={history.filter(i => ('folder' in i ? i.folder === currentFolder : true)).findIndex(i => i.file_id === modalItem?.file_id)}
          setModalItem={setModalItem}
          onDelete={async () => {
            if (window.confirm('确定要删除这张图片吗？')) {
              try {
                const res = await fetchWithAuth('/api/delete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ids: [modalItem.file_id] })
                });
                const data = await res.json();
                if (data.status === 'success') {
                  setToast({ message: '删除成功', type: 'success' });
                  closeModal();
                  fetchImages(search, tagFilter, filenameFilter, 1, false, currentFolder);
                  fetchStats();
                } else {
                  setToast({ message: '删除失败', type: 'error' });
                }
              } catch {
                setToast({ message: '删除失败', type: 'error' });
              }
            }
          }}
        />
      )}
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

// 在 AppContent 组件底部添加 ImageDetailModal 组件
function ImageDetailModal({ open, item, onClose, imgInfo, handleCopy, images, currentIndex, setModalItem, onDelete }: {
  open: boolean,
  item: any,
  onClose: () => void,
  imgInfo: { width: number, height: number, size: number },
  handleCopy: (text: string) => void,
  images: any[],
  currentIndex: number,
  setModalItem: (item: any) => void,
  onDelete: () => void
}) {
  if (!open || !item) return null;
  const SHORTLINK_DOMAIN = (window as any).SHORTLINK_DOMAIN || window.location.origin;
  // 下载图片
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/api/get_photo/${item.file_id}`;
    link.download = item.filename || item.file_id;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  // 键盘左右键切换
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setModalItem(images[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
        setModalItem(images[currentIndex + 1]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, images, setModalItem]);
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div
          className="bg-[#181f29] rounded-2xl shadow-2xl p-0 relative flex flex-col"
          onClick={e => e.stopPropagation()}
          style={{
            width: '70vw',
            height: '80vh',
            maxWidth: 1200,
            maxHeight: 800,
            margin: 'auto',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <button className="absolute top-4 right-6 text-gray-400 hover:text-cyan-400 text-3xl z-10" onClick={onClose}>×</button>
          {/* 左右切换按钮 */}
          {currentIndex > 0 && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-cyan-700 text-white rounded-full w-10 h-10 flex items-center justify-center z-20"
              onClick={() => setModalItem(images[currentIndex - 1])}
              style={{ fontSize: 28 }}
            >&#8592;</button>
          )}
          {currentIndex < images.length - 1 && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-cyan-700 text-white rounded-full w-10 h-10 flex items-center justify-center z-20"
              onClick={() => setModalItem(images[currentIndex + 1])}
              style={{ fontSize: 28 }}
            >&#8594;</button>
          )}
          <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 0}}>
            {/* 图片和加载动画等内容 */}
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
              src={`/api/get_photo/${item.file_id}`}
              alt="大图"
              className="w-full h-full object-contain bg-[#232b36]"
              style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', margin: '0 auto', flex: 1 }}
              onLoad={e => {
                const target = e.currentTarget as HTMLImageElement | null;
                if (target && target.naturalWidth && target.naturalHeight) {
                  // 只在首次加载时设置尺寸
                  if (!imgInfo.width || !imgInfo.height) {
                    setTimeout(() => {
                      // 避免多次 setState
                      if (typeof window !== 'undefined') {
                        const evt = new Event('resize');
                        window.dispatchEvent(evt);
                      }
                    }, 0);
                  }
                }
              }}
              onError={() => {
                // 只设置一次失败
              }}
            />
          </div>
          <div className="space-y-2 p-4">
            <div className="text-base font-bold text-gray-100 truncate">{item.filename || item.file_id}</div>
            <div className="text-xs text-gray-400">上传时间：{new Date(item.created_at).toLocaleString()}</div>
            <div className="text-xs text-gray-400">标签：{item.tags || '-'}</div>
            <div className="text-xs text-gray-400">尺寸：{imgInfo.width} × {imgInfo.height}</div>
            <div className="text-xs text-gray-400">大小：{imgInfo.size > 0 ? (imgInfo.size > 1024*1024 ? (imgInfo.size/1024/1024).toFixed(2)+' MB' : (imgInfo.size/1024).toFixed(1)+' KB') : '-'}</div>
            {/* 操作按钮区域 */}
            <div className="flex gap-2 mt-3">
              <button
                className="px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
                onClick={handleDownload}
              >
                📥 下载
              </button>
              <button
                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                onClick={onDelete}
              >
                🗑️ 删除
              </button>
            </div>
            {item.short_code && (
              <>
                <div className="text-xs text-gray-400 flex items-center">直链：
                  <a href={`${SHORTLINK_DOMAIN}/img/${item.short_code}`} target="_blank" rel="noopener" className="text-cyan-400 underline break-all ml-1">{`${SHORTLINK_DOMAIN}/img/${item.short_code}`}</a>
                  <button className="ml-2 px-2 py-1 text-xs bg-[#232b36] rounded hover:bg-cyan-700 text-cyan-300" onClick={()=>handleCopy(`${SHORTLINK_DOMAIN}/img/${item.short_code}`)}>复制</button>
                </div>
                <div className="text-xs text-gray-400 flex items-center">Markdown：
                  <a href={`${SHORTLINK_DOMAIN}/img/${item.short_code}`} target="_blank" rel="noopener" className="text-cyan-400 underline mx-1" style={{ wordBreak: 'break-all' }}>{`![](${SHORTLINK_DOMAIN}/img/${item.short_code})`}</a>
                  <button className="ml-2 px-2 py-1 text-xs bg-[#232b36] rounded hover:bg-cyan-700 text-cyan-300" onClick={()=>handleCopy(`![](${SHORTLINK_DOMAIN}/img/${item.short_code})`)}>复制</button>
                </div>
                <div className="text-xs text-gray-400 flex items-center">HTML：
                  <a href={`${SHORTLINK_DOMAIN}/img/${item.short_code}`} target="_blank" rel="noopener" className="text-cyan-400 underline mx-1" style={{ wordBreak: 'break-all' }}>{`<img src=\"${SHORTLINK_DOMAIN}/img/${item.short_code}\" />`}</a>
                  <button className="ml-2 px-2 py-1 text-xs bg-[#232b36] rounded hover:bg-cyan-700 text-cyan-300" onClick={()=>handleCopy(`<img src=\"${SHORTLINK_DOMAIN}/img/${item.short_code}\" />`)}>复制</button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default App;
