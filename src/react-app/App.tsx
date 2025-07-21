
import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

// 添加错误边界组件
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setHasError(true);
      setError(e.error);
      e.preventDefault();
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl text-red-600 mb-4">页面加载出错</h2>
        <p className="text-gray-700 mb-2">{error?.message}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        >
          重新加载
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

function AppContent() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState<Array<{ id: number; file_id: string; created_at: string }>>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(8); // 每页条数
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0 });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = async (pageNum = 1, limitNum = 8, searchVal = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: String(limitNum) });
      if (searchVal) params.append('search', searchVal);
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
      console.error('Failed to fetch history:', error);
      alert('加载历史记录失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(page, limit, search);
    // eslint-disable-next-line
  }, [page, limit, search]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) return;
    setPending(true);

    try {
      const formData = new FormData(e.currentTarget);
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const res = await response.json();

      if (res.status === 'success') {
        alert('图片已成功上传到 Telegram');
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setPage(1);
        setSearch('');
        setSearchInput('');
        fetchHistory(1, limit, '');
      } else {
        alert(`上传失败: ${res.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('上传失败，请重试');
    } finally {
      setPending(false);
    }
  };

  // 搜索按钮点击
  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  // 回车搜索
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 分页按钮
  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };
  const handleNextPage = () => {
    if (history.length === limit) setPage(page + 1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">图片上传到 Telegram</h1>

      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* 文件上传区域 */}
          <div className="space-y-2">
            <label
              htmlFor="photo"
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md border border-gray-300 transition duration-300 flex items-center justify-center cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              选择图片
              <input
                type="file"
                id="photo"
                name="photo"
                accept="image/*"
                required
                className="hidden"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
            </label>

            {selectedFile && (
              <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-md flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <span>{selectedFile.name}</span>
              </div>
            )}

            {previewUrl && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">图片预览:</p>
                <div className="relative rounded-lg overflow-hidden border border-gray-300">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-auto object-contain max-h-60"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-300 disabled:bg-blue-400 disabled:cursor-not-allowed"
              disabled={pending || !selectedFile}
            >
              {pending ? '上传中...' : '上传到 Telegram'}
            </button>
          </div>
        </form>
      </div>

      {/* 历史记录区域 */}
      <div className="mt-12 max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">上传历史记录</h2>
        {/* 搜索栏 */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            placeholder="搜索 file_id 或 chat_id"
            className="border rounded px-3 py-2 w-full max-w-xs"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={handleSearch}
            type="button"
          >
            搜索
          </button>
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
          <p className="text-gray-500 text-center py-6">暂无上传记录</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map(item => (
              <div key={item.id} className="border rounded-lg p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <img 
                  src={`/api/get_photo/${item.file_id}`} 
                  alt="History preview" 
                  className="w-20 h-20 object-cover rounded"
                  onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/100?text=加载失败'}
                />
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">{item.file_id}</p>
                  <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
