export interface ImageItem {
  id: number;
  file_id: string;
  created_at: string;
  short_code?: string;
  tags?: string;
  filename?: string;
  url?: string;
}

export interface FolderSelectorProps {
  folderList: string[];
  selectedFolder: string;
  onFolderChange: (folder: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (folder: string) => void;
  showAddFolder: boolean;
  setShowAddFolder: (v: boolean) => void;
  newFolder: string;
  setNewFolder: (v: string) => void;
  showRenameInput: boolean;
  setShowRenameInput: (v: boolean) => void;
  renameFolder: string;
  setRenameFolder: (v: string) => void;
}

export interface TagSelectorProps {
  tagOptions: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  showAddTag: boolean;
  setShowAddTag: (v: boolean) => void;
  newTag: string;
  setNewTag: (v: string) => void;
  onAddTag: () => void;
}

export interface UploadPreviewProps {
  files: File[];
  fileUrls: string[];
  onDelete: (idx: number) => void;
}

export interface ImageCardProps {
  img: ImageItem;
  isSelected: boolean;
  selectMode: boolean;
  onClick: () => void;
}

export interface ImageModalProps {
  open: boolean;
  img: ImageItem | null;
  onClose: () => void;
  onCopy: (text: string) => void;
} 