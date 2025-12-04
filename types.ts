export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO'
}

export interface ProcessingState {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  message?: string;
  progress?: number;
}

export interface MediaAsset {
  id: string;
  file: File;
  previewUrl: string;
  type: MediaType;
  width?: number;
  height?: number;
}

export interface GenerationResult {
  originalUrl: string;
  resultUrl: string;
  type: MediaType;
}