import React, { useState, useRef, useEffect, useMemo } from 'react';
import Masonry from 'react-masonry-css';
import Toast from './components/Toast';
import FolderSelector from './components/FolderSelector';
import TagSelector from './components/TagSelector';
import UploadPreview from './components/UploadPreview';
import ImageCard from './components/ImageCard';
import ImageModal from './components/ImageModal';
import { compressImage, handleUploadAll } from './utils/uploadManager';

function App() {
  const [authChecked, setAuthChecked] = React.useState(false);
  const [isAuthed, setIsAuthed] = React.useState(false);

  // 页面加载时自动检查登录状态，带上 Authorization 头
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsAuthed(false);
      setAuthChecked(true);
      return;
    }
    fetch('/api/settings', { headers: { Authorization: 'Bearer ' + token } })
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
  // 所有 hooks 顶层声明
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [history, setHistory] = useState<Array<{ id: number; file_id: string; created_at: string; short_code?: string; tags?: string; filename?: string }>>([]);
  const [search] = useState('');
  // Toast 状态，带默认 type
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' }>({ message: '', type: 'info' });
  // 统一的 toast 工具函数，保证 type 总有默认值
  const showToast = (toast: { message: string; type?: 'info' | 'error' | 'success' }) => {
    setToast({
      message: toast.message,
      type: toast.type ?? 'info',
    });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expire, setExpire] = useState('forever');
  const [selected, setSelected] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState('');
  const [filenameFilter] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  type TabType = 'upload' | 'gallery' | 'settings';
  const [tab, setTab] = useState<TabType>('upload');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<any>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [tagOptions, setTagOptions] = useState<string[]>(['默认']);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [pageTitle, setPageTitle] = useState(() => localStorage.getItem('pageTitle') || '图床');
  const [faviconUrl, setFaviconUrl] = useState(() => localStorage.getItem('faviconUrl') || '/favicon.ico');
  const [titleInput, setTitleInput] = useState('图床');
  const [faviconFile, setFaviconFile] = useState<File|null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;
  const [maxConcurrentUploads, setMaxConcurrentUploads] = useState(3);
  const [folderList, setFolderList] = useState<string[]>(['/']);
  const [selectedFolder, setSelectedFolder] = useState<string>('/');
  const [newFolder, setNewFolder] = useState('');
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [renameFolder, setRenameFolder] = useState('');
  const [showRenameInput, setShowRenameInput] = useState(false);

  // 集中管理 fileUrls，防止内存泄漏
  const fileUrlsRef = useRef<string[]>([]);
  const fileUrls = useMemo(() => {
    // 先回收所有旧 URL
    fileUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    // 生成新 URL
    const urls = files.map(file => URL.createObjectURL(file));
    fileUrlsRef.current = urls;
    return urls;
  }, [files]);

  useEffect(() => {
    // 组件卸载时回收所有 URL
    return () => {
      fileUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      fileUrlsRef.current = [];
    };
  }, []);

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

  // 压缩提示状态
  const [compressing, setCompressing] = useState(false);

  // 选择图片时，若图片大于10MB，自动压缩后再加入 files 队列，并显示压缩提示
  const handleAddFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    const processedFiles: File[] = [];
    let needCompress = arr.some(f => f.size > 10 * 1024 * 1024);
    if (needCompress) setCompressing(true);
    for (const f of arr) {
      if (f.size > 10 * 1024 * 1024) {
        const compressed = await compressImage(f);
        if (compressed.size <= 10 * 1024 * 1024) {
          processedFiles.push(compressed);
        } else {
          showToast({ message: `${f.name} 压缩后仍大于10MB，无法添加`, type: 'error' });
        }
      } else {
        processedFiles.push(f);
      }
    }
    setFiles(prev => {
      // 按文件名和大小去重
      const existing = new Set(prev.map(f => f.name + '_' + f.size));
      const newFiles = processedFiles.filter(f => !existing.has(f.name + '_' + f.size));
      return [...prev, ...newFiles];
    });
    if (needCompress) setCompressing(false);
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

  // 复制短链/Markdown/HTML
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: '已复制到剪贴板', type: 'success' });
    } catch {
      showToast({ message: '复制失败', type: 'error' });
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
    showToast({ message: '已提交删除', type: 'info' });
    // 后台异步删除
    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
        credentials: 'include',
        body: JSON.stringify({ ids: selected })
      });
      const data = await res.json();
      if (data.status === 'success') {
        showToast({ message: '删除成功', type: 'success' });
        setSelected([]);
      } else {
        // 回滚
        setHistory(prev => [...removed, ...prev]);
        showToast({ message: '删除失败，请重试', type: 'error' });
      }
    } catch {
      setHistory(prev => [...removed, ...prev]);
      showToast({ message: '删除失败', type: 'error' });
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

  // 获取统计
  const fetchStats = async () => {
    if (!isAuthed) return;
    try {
      const res = await fetch('/api/stats', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      const data = await res.json();
      if (data.status === 'success') {
      }
    } catch (err) {}
  };
  React.useEffect(() => { if (isAuthed) fetchStats(); }, [isAuthed]);

  // 获取设置
  const fetchSettings = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/settings', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (data.status === 'success') {
      }
    } catch {}
  };
  React.useEffect(() => { if (tab === 'settings') fetchSettings(); }, [tab]);

  // 弹窗打开时获取图片尺寸和大小
  // 在弹窗图片加载 useEffect 里加 img.src = '' 清理
  useEffect(() => {
    if (!modalOpen || !modalItem) return;
    const img = new window.Image();
    img.onload = () => {};
    img.src = `/api/get_photo/${modalItem.file_id}`;
    return () => { img.src = ''; };
  }, [modalOpen, modalItem]);

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
        localStorage.setItem('token', data.token);
        setTimeout(() => {
          window.location.reload(); // 登录成功后延迟刷新，确保 token 写入
        }, 100);
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
    await fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    localStorage.removeItem('token');
    window.location.reload(); // 直接刷新页面，避免中间错误状态
  };

  let content;
  if (!isAuthed) {
    content = (
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
  } else {

    // MasonryList渲染函数
    const renderMasonryItem = (img: any) => (
      <ImageCard
        img={img}
        isSelected={selectMode && selected.includes(img.file_id)}
        selectMode={selectMode}
        onClick={() => {
          if (selectMode) {
            if (selected.includes(img.file_id)) setSelected(prev => prev.filter(id => id !== img.file_id));
            else setSelected(prev => [...prev, img.file_id]);
          } else {
            openModal(img);
          }
        }}
      />
    );

    // Masonry断点配置
    const breakpointColumnsObj = {
      default: 6,
      1200: 5,
      900: 4,
      700: 3,
      500: 2
    };

    // Masonry items准备
    const displayItems = history.length === 0
      ? Array.from({ length: 20 }, (_, i) => ({ skeleton: true, id: 'skeleton-' + i }))
      : history;

    // 批量移动图片到文件夹
    const handleBatchMove = async (targetFolder: string) => {
      if (selected.length === 0) return;
      try {
        const res = await fetch('/api/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
          credentials: 'include',
          body: JSON.stringify({ ids: selected, folder: targetFolder })
        });
        const data = await res.json();
        if (data.status === 'success') {
          showToast({ message: '移动成功', type: 'success' });
          // fetchHistory(search, tagFilter, filenameFilter, page, false); // 移除旧的 fetchHistory 调用
          setSelected([]);
        } else {
          showToast({ message: data.message || '移动失败', type: 'error' });
        }
      } catch {
        showToast({ message: '移动失败', type: 'error' });
      }
    };

    // 在AppContent顶部添加重命名/删除相关状态

    // 重命名文件夹
    const handleRenameFolder = async (oldName: string, newName: string) => {
      if (!oldName || !newName || oldName === newName) return;
      try {
        const res = await fetch('/api/rename_folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
          credentials: 'include',
          body: JSON.stringify({ oldName, newName })
        });
        const data = await res.json();
        if (data.status === 'success') {
          showToast({ message: '重命名成功', type: 'success' });
          // fetchFolders(); // 移除旧的 fetchFolders 调用
          if (selectedFolder === oldName) setSelectedFolder(newName);
          setShowRenameInput(false);
          setRenameFolder('');
          // 刷新图库
          if (tab === 'gallery') {
            fetchGalleryOverview(selectedFolder, 1);
          }
        } else {
          showToast({ message: data.message || '重命名失败', type: 'error' });
        }
      } catch {
        showToast({ message: '重命名失败', type: 'error' });
      }
    };
    // 删除文件夹
    const handleDeleteFolder = async (folder: string) => {
      if (!folder || folder === '/') return;
      if (!window.confirm(`确定要删除文件夹"${folder}"及其所有图片吗？`)) return;
      try {
        const res = await fetch('/api/delete_folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
          credentials: 'include',
          body: JSON.stringify({ folder })
        });
        const data = await res.json();
        if (data.status === 'success') {
          showToast({ message: '删除成功', type: 'success' });
          // fetchFolders(); // 移除旧的 fetchFolders 调用
          setSelectedFolder('/');
          // 刷新图库
          if (tab === 'gallery') {
            fetchGalleryOverview(selectedFolder, 1);
          }
        } else {
          showToast({ message: data.message || '删除失败', type: 'error' });
        }
      } catch {
        showToast({ message: '删除失败', type: 'error' });
      }
    };

    const fetchGalleryOverview = async (folder = selectedFolder, page = 1) => {
      try {
        const params = new URLSearchParams();
        params.append('folder', folder);
        params.append('page', String(page));
        params.append('limit', String(LIMIT));
        if (search) params.append('search', search);
        if (tagFilter) params.append('tag', tagFilter);
        if (filenameFilter) params.append('filename', filenameFilter);
        const res = await fetch(`/api/gallery_overview?${params.toString()}`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
        const data = await res.json();
        if (data.status === 'success') {
          setFolderList(data.folders);
          setHistory(data.images);
          setHasMore(data.images.length >= LIMIT);
          return data; // 返回数据以便缓存
        }
        return null; // 失败则返回 null
      } catch {
        return null; // 网络错误则返回 null
      }
    };

    // fetchGalleryOverview 缓存和防抖
    const galleryCacheRef = useRef(new Map());
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (!isAuthed) return;
      const cacheKey = JSON.stringify({ folder: selectedFolder, tab, tagFilter, filenameFilter, search });
      if (galleryCacheRef.current.has(cacheKey)) {
        // 命中缓存，直接用缓存数据
        setHistory(galleryCacheRef.current.get(cacheKey).images);
        setFolderList(galleryCacheRef.current.get(cacheKey).folders);
        setHasMore(galleryCacheRef.current.get(cacheKey).images.length >= LIMIT);
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const data = await fetchGalleryOverview(selectedFolder, 1);
        if (data) { // 确保数据成功获取
          galleryCacheRef.current.set(cacheKey, data);
          setHistory(data.images);
          setFolderList(data.folders);
          setHasMore(data.images.length >= LIMIT);
        }
      }, 400);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, [isAuthed, tab, selectedFolder, tagFilter, filenameFilter, search]);

    // 事件处理函数也无条件声明在顶层
    const openModal = (item: any) => { setModalItem(item); setModalOpen(true); };
    const closeModal = () => { setModalOpen(false); setModalItem(null); };
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

    content = (
      <div className="w-full min-h-screen bg-[#10151b]">
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
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
        <div className={`fade-content`} key={tab}>
          {tab==='upload' && (
            <div
              className={`card card-hover mt-8 mb-8 transition-all duration-200 w-full sm:w-3/4 mx-auto ${dragActive ? 'ring-4 ring-cyan-400 shadow-2xl' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* 拖拽+点击上传区域 */}
              <div
                className={`w-full aspect-[4/1] flex flex-col items-center justify-center mb-4 border-2 border-dashed rounded-xl transition-colors duration-200 ${dragActive ? 'border-cyan-400 bg-[#1a2230]' : 'border-gray-500 bg-[#232b36]/60'}`}
                style={{ cursor: 'pointer', position: 'relative' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="text-gray-400 text-base select-none">拖拽图片到此区域或点击选择图片</span>
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
              </div>
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleUploadAll(files, { expire, tags: selectedTags.length > 0 ? selectedTags : ['默认'], folder: selectedFolder || '/', maxConcurrentUploads }); }}>
                {/* 文件夹选择栏，已抽离为组件 */}
                <FolderSelector
                  folderList={folderList}
                  selectedFolder={selectedFolder}
                  onFolderChange={folder => {
                    setSelectedFolder(folder);
                    setPage(1);
                    setHasMore(true);
                    fetchGalleryOverview(folder, 1);
                  }}
                  onRename={handleRenameFolder}
                  onDelete={handleDeleteFolder}
                  showAddFolder={showAddFolder}
                  setShowAddFolder={setShowAddFolder}
                  newFolder={newFolder}
                  setNewFolder={setNewFolder}
                  showRenameInput={showRenameInput}
                  setShowRenameInput={setShowRenameInput}
                  renameFolder={renameFolder}
                  setRenameFolder={setRenameFolder}
                />
                {/* 标签输入 */}
                <TagSelector
                  tagOptions={tagOptions}
                  selectedTags={selectedTags}
                  onToggleTag={handleToggleTag}
                  showAddTag={showAddTag}
                  setShowAddTag={setShowAddTag}
                  newTag={newTag}
                  setNewTag={setNewTag}
                  onAddTag={handleAddTag}
                />
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
                {/* 批量上传按钮下方显示压缩提示 */}
                {compressing && (
                  <div className="w-full text-center text-cyan-400 py-2">正在压缩大图片，请稍候...</div>
                )}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-300 disabled:bg-blue-400 disabled:cursor-not-allowed"
                    disabled={files.length === 0}
                  >
                    {files.length === 0 ? '请选择图片' : '批量上传'}
                  </button>
                </div>
              </form>
              {/* 待上传图片预览区（移动到批量上传按钮下方） */}
              <UploadPreview files={files} fileUrls={fileUrls} onDelete={idx => setFiles(prev => prev.filter((_, i) => i !== idx))} />
            </div>
          )}
          {tab==='gallery' && (
            <div className="card card-hover mt-8 mb-8 w-full sm:w-3/4 mx-auto">
              <div className="mt-8 sm:mt-12 mx-auto">
                <h2 className="text-xl sm:text-2xl font-semibold mb-4">图库</h2>
                {/* 文件夹筛选栏 */}
                <FolderSelector
                  folderList={folderList}
                  selectedFolder={selectedFolder}
                  onFolderChange={folder => {
                    setSelectedFolder(folder);
                    setPage(1);
                    setHasMore(true);
                    fetchGalleryOverview(folder, 1);
                  }}
                  onRename={handleRenameFolder}
                  onDelete={handleDeleteFolder}
                  showAddFolder={showAddFolder}
                  setShowAddFolder={setShowAddFolder}
                  newFolder={newFolder}
                  setNewFolder={setNewFolder}
                  showRenameInput={showRenameInput}
                  setShowRenameInput={setShowRenameInput}
                  renameFolder={renameFolder}
                  setRenameFolder={setRenameFolder}
                />
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
                      <select
                        className="bg-[#232b36] text-gray-100 border rounded px-2 py-1 ml-2"
                        value={''}
                        onChange={e => handleBatchMove(e.target.value)}
                      >
                        <option value="">移动到文件夹</option>
                        {folderList.map(folder => (
                          <option key={folder} value={folder}>{folder}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                {/* 加载状态 */}
                {history.length === 0 ? (
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
                    {hasMore && (
                      <div style={{textAlign:'center',padding:'16px'}}>
                        <button
                          style={{
                            background: '#22d3ee', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 32px', fontSize: 16, cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 8px #22d3ee33', marginRight: 16
                          }}
                          onClick={() => {
                            const nextPage = page + 1;
                            setPage(nextPage);
                            fetchGalleryOverview(selectedFolder, nextPage);
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
            <div className="card card-hover mt-8 mb-8 flex justify-center w-full sm:w-3/4 mx-auto">
              <div className="w-full p-6 mx-auto">
                {/* 统计区块融合到设置项最上方 */}
                <div className="flex gap-8 mb-8">
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-2xl font-bold text-cyan-400">{history.length}</span>
                    <span className="text-xs text-gray-400 mt-1">上传总数</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-2xl font-bold text-cyan-400">{(history.reduce((sum, item) => sum + (typeof (item as any).size === 'number' ? (item as any).size : 0), 0) / 1024 / 1024).toFixed(2)} MB</span>
                    <span className="text-xs text-gray-400 mt-1">空间占用</span>
                  </div>
                </div>
                <h2 className="text-lg font-bold mb-4 text-cyan-400">系统设置</h2>
                <div className="space-y-6">
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
                      onClick={async () => {
                        showToast({ message: '正在去重...', type: 'info' });
                        try {
                          const res = await fetch('/api/deduplicate', { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
                          const data = await res.json();
                          if (data.status === 'success') {
                            showToast({ message: `去重完成，删除了${data.deleted || 0}条重复图片`, type: 'success' });
                            // fetchHistory(search, tagFilter, filenameFilter); // 移除旧的 fetchHistory 调用
                            fetchGalleryOverview(selectedFolder, 1);
                          } else {
                            showToast({ message: data.message || '去重失败', type: 'error' });
                          }
                        } catch (e) {
                          showToast({ message: '去重失败，请重试', type: 'error' });
                        }
                      }}
                    >去重</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* 图片详情弹窗 */}
        <ImageModal open={modalOpen} img={modalItem} onClose={closeModal} onCopy={handleCopy} />
      </div>
    );
  }

  // 统一 return
  return <>{content}</>;
}

export default App;