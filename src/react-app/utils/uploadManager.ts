import SparkMD5 from 'spark-md5';

export async function calcFileHash(file: File): Promise<string> {
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
}

export function compressImage(file: File, quality = 0.7, maxW = 1600, maxH = 1600): Promise<File> {
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
}

export async function uploadFile(file: File, hash: string, options: {
  expire: string;
  tags: string[];
  folder: string;
  maxRetries?: number;
  onSuccess?: () => void;
  onError?: (err: any) => void;
}): Promise<void> {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('expire', options.expire);
  formData.append('tags', options.tags.join(','));
  formData.append('filename', file.name);
  formData.append('hash', hash);
  formData.append('folder', options.folder || '/');
  let attempt = 0;
  const maxRetries = options.maxRetries ?? 3;
  while (attempt < maxRetries) {
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');
        xhr.onload = () => {
          try {
            const res = JSON.parse(xhr.responseText);
            if (xhr.status === 200 && res.status === 'success') {
              options.onSuccess?.();
              resolve();
            } else {
              options.onError?.(res.message || '上传失败');
              reject(new Error(res.message || '上传失败'));
            }
          } catch (err) {
            options.onError?.('服务器响应异常');
            reject(err);
          }
        };
        xhr.onerror = () => {
          options.onError?.('上传失败');
          reject(new Error('上传失败'));
        };
        xhr.send(formData);
      });
      return;
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

export async function handleUploadAll(files: File[], options: {
  expire: string;
  tags: string[];
  folder: string;
  maxConcurrentUploads?: number;
  onProgress?: (progress: number) => void;
  onSuccess?: (idx: number) => void;
  onError?: (idx: number, err: any) => void;
  onComplete?: (failedIdx: number[]) => void;
}) {
  const maxConcurrentUploads = options.maxConcurrentUploads ?? 3;
  let active = 0;
  let finished = 0;
  const total = files.length;
  const uploadingHashes = new Set<string>();
  const failedIdxSet = new Set<number>();
  const uploadQueue = files.slice();
  const next = async () => {
    if (uploadQueue.length === 0) return;
    if (active >= maxConcurrentUploads) return;
    const idx = files.length - uploadQueue.length;
    const file = uploadQueue.shift();
    if (!file) return;
    const hash = await calcFileHash(file);
    if (uploadingHashes.has(hash)) {
      finished++;
      options.onProgress?.(Math.round((finished / total) * 100));
      next();
      return;
    }
    uploadingHashes.add(hash);
    active++;
    try {
      await uploadFile(file, hash, {
        expire: options.expire,
        tags: options.tags,
        folder: options.folder,
        onSuccess: () => options.onSuccess?.(idx),
        onError: (err) => options.onError?.(idx, err),
      });
    } catch (err) {
      failedIdxSet.add(idx);
      options.onError?.(idx, err);
    } finally {
      uploadingHashes.delete(hash);
    }
    active--;
    finished++;
    options.onProgress?.(Math.round((finished / total) * 100));
    if (finished < total) next();
  };
  for (let i = 0; i < maxConcurrentUploads; i++) next();
  while (finished < total) await new Promise(r => setTimeout(r, 100));
  uploadingHashes.clear();
  options.onComplete?.(Array.from(failedIdxSet));
} 