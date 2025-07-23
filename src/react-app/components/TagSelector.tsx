import React from 'react';
import type { TagSelectorProps } from '../types';

const TagSelector: React.FC<TagSelectorProps> = ({
  tagOptions,
  selectedTags,
  onToggleTag,
  showAddTag,
  setShowAddTag,
  newTag,
  setNewTag,
  onAddTag,
}) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-300">标签：</span>
      {tagOptions.map(tag => (
        <button
          key={tag}
          type="button"
          className={`px-2 py-1 text-xs rounded border ${selectedTags.includes(tag) ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-[#232b36] text-cyan-300 border-cyan-300'} hover:bg-cyan-700`}
          onClick={() => onToggleTag(tag)}
        >{tag}</button>
      ))}
      <button
        type="button"
        className="px-2 py-1 text-xs bg-cyan-700 text-white rounded hover:bg-cyan-800"
        onClick={() => setShowAddTag(true)}
      >新建</button>
      {showAddTag && (
        <form
          onSubmit={e => { e.preventDefault(); onAddTag(); }}
          className="flex items-center gap-1"
        >
          <input
            className="bg-[#232b36] text-gray-100 border rounded px-2 py-1 text-xs"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            placeholder="新标签"
            autoFocus
          />
          <button type="submit" className="px-2 py-1 text-xs bg-cyan-600 text-white rounded">确定</button>
          <button type="button" className="px-2 py-1 text-xs bg-gray-500 text-white rounded" onClick={() => setShowAddTag(false)}>取消</button>
        </form>
      )}
    </div>
  );
};

export default TagSelector; 