import React from 'react';
import type { FolderSelectorProps } from '../types';

const FolderSelector: React.FC<FolderSelectorProps> = ({
  folderList,
  selectedFolder,
  onFolderChange,
  onRename,
  onDelete,
  showAddFolder,
  setShowAddFolder,
  newFolder,
  setNewFolder,
  showRenameInput,
  setShowRenameInput,
  renameFolder,
  setRenameFolder,
}) => {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm text-gray-300">文件夹：</span>
      <select
        className="bg-[#232b36] text-gray-100 border rounded px-2 py-1"
        value={selectedFolder}
        onChange={e => onFolderChange(e.target.value)}
      >
        {folderList.map(folder => (
          <option key={folder} value={folder}>{folder}</option>
        ))}
      </select>
      <button
        type="button"
        className="px-2 py-1 text-xs bg-cyan-700 text-white rounded hover:bg-cyan-800"
        onClick={() => setShowAddFolder(true)}
      >新建</button>
      {selectedFolder !== '/' && (
        <>
          <button
            type="button"
            className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
            onClick={() => {
              setRenameFolder(selectedFolder);
              setShowRenameInput(true);
            }}
          >重命名</button>
          <button
            type="button"
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            onClick={() => onDelete(selectedFolder)}
          >删除</button>
        </>
      )}
      {/* 新建文件夹输入框 */}
      {showAddFolder && (
        <form
          onSubmit={e => {
            e.preventDefault();
            if (newFolder.trim()) {
              onFolderChange(newFolder.trim());
              setShowAddFolder(false);
              setNewFolder('');
            }
          }}
          className="flex items-center gap-1"
        >
          <input
            className="bg-[#232b36] text-gray-100 border rounded px-2 py-1 text-xs"
            value={newFolder}
            onChange={e => setNewFolder(e.target.value)}
            placeholder="新文件夹名"
            autoFocus
          />
          <button type="submit" className="px-2 py-1 text-xs bg-cyan-600 text-white rounded">确定</button>
          <button type="button" className="px-2 py-1 text-xs bg-gray-500 text-white rounded" onClick={() => setShowAddFolder(false)}>取消</button>
        </form>
      )}
      {/* 重命名输入框 */}
      {showRenameInput && (
        <form
          onSubmit={e => {
            e.preventDefault();
            if (renameFolder.trim() && renameFolder !== selectedFolder) {
              onRename(selectedFolder, renameFolder.trim());
            }
            setShowRenameInput(false);
          }}
          className="flex items-center gap-1"
        >
          <input
            className="bg-[#232b36] text-gray-100 border rounded px-2 py-1 text-xs"
            value={renameFolder}
            onChange={e => setRenameFolder(e.target.value)}
            placeholder="新文件夹名"
            autoFocus
          />
          <button type="submit" className="px-2 py-1 text-xs bg-yellow-600 text-white rounded">确定</button>
          <button type="button" className="px-2 py-1 text-xs bg-gray-500 text-white rounded" onClick={() => setShowRenameInput(false)}>取消</button>
        </form>
      )}
    </div>
  );
};

export default FolderSelector; 