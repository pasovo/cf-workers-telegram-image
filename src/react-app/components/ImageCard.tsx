import React from 'react';
import type { ImageCardProps } from '../types';

const ImageCard: React.FC<ImageCardProps> = ({ img, isSelected, selectMode, onClick }) => {
  if ((img as any).skeleton) {
    return (
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
  }
  return (
    <div
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
      onClick={onClick}
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

export default ImageCard; 