import React from 'react';
import type { UploadPreviewProps } from '../types';

const UploadPreview: React.FC<UploadPreviewProps> = ({ files, fileUrls, onDelete }) => {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-2 justify-center mb-4">
      {files.map((file, idx) => {
        const url = fileUrls[idx];
        return url ? (
          <div key={file.name + '_' + file.size} style={{ width: 100, height: 100, position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#232b36', boxShadow: '0 2px 8px #232b3633' }}>
            <img
              src={url}
              alt={file.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
            />
            <button
              type="button"
              onClick={() => onDelete(idx)}
              style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontWeight: 'bold', fontSize: 16, lineHeight: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="移除"
            >×</button>
          </div>
        ) : null;
      })}
    </div>
  );
};

export default UploadPreview; 