import React from 'react';
import type { ImageModalProps } from '../types';

const ImageModal: React.FC<ImageModalProps> = ({ open, img, onClose, onCopy }) => {
  if (!open || !img) return null;
  const fileUrl = img.url || `/api/get_photo/${img.file_id}`;
  const md = `![${img.filename || img.file_id}](${fileUrl})`;
  const html = `<img src=\"${fileUrl}\" alt=\"${img.filename || img.file_id}\" />`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
      <div className="bg-[#232b36] rounded-lg p-6 relative max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <button
          className="absolute top-2 right-2 text-white text-2xl font-bold hover:text-cyan-400"
          onClick={onClose}
          style={{ lineHeight: 1 }}
        >×</button>
        <img
          src={fileUrl}
          alt={img.filename || img.file_id}
          className="rounded max-w-full max-h-[60vh] mb-4"
          style={{ background: '#181f29' }}
        />
        <div className="flex flex-col gap-2 w-full">
          <div className="flex gap-2 items-center">
            <span className="text-gray-300 text-sm">直链：</span>
            <input className="flex-1 bg-[#181f29] text-gray-100 px-2 py-1 rounded text-xs" value={fileUrl} readOnly />
            <button className="px-2 py-1 text-xs bg-cyan-600 text-white rounded" onClick={() => onCopy(fileUrl)}>复制</button>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-gray-300 text-sm">Markdown：</span>
            <input className="flex-1 bg-[#181f29] text-gray-100 px-2 py-1 rounded text-xs" value={md} readOnly />
            <button className="px-2 py-1 text-xs bg-cyan-600 text-white rounded" onClick={() => onCopy(md)}>复制</button>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-gray-300 text-sm">HTML：</span>
            <input className="flex-1 bg-[#181f29] text-gray-100 px-2 py-1 rounded text-xs" value={html} readOnly />
            <button className="px-2 py-1 text-xs bg-cyan-600 text-white rounded" onClick={() => onCopy(html)}>复制</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal; 