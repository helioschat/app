import { createPreviewUrl } from '$lib/database/messages';
import type { Attachment, AttachmentType } from '$lib/types';
import { v7 as uuidv7 } from 'uuid';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const FILE_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function isImageType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.includes(mimeType.toLowerCase());
}

export function isFileType(mimeType: string): boolean {
  return FILE_MIME_TYPES.includes(mimeType.toLowerCase());
}

/**
 * Returns a string suitable for the `accept` attribute of a file input element based on
 * the model's supported input modalities.
 * This avoids computing the same array in multiple components.
 */
export function getAcceptForModalities(modelFeatures: string[]): string {
  const { supportsImages, supportsFiles } = getSupportedModalities(modelFeatures);
  const types: string[] = [];
  if (supportsImages) types.push(...IMAGE_MIME_TYPES);
  if (supportsFiles) types.push(...FILE_MIME_TYPES);
  return types.join(',');
}

export function validateFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

export function getAttachmentType(mimeType: string): AttachmentType | null {
  if (isImageType(mimeType)) {
    return 'image';
  }
  if (isFileType(mimeType)) {
    return 'file';
  }
  return null;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:mime/type;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function createAttachment(file: File): Promise<Attachment | null> {
  if (!validateFileSize(file.size)) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }

  const attachmentType = getAttachmentType(file.type);
  if (!attachmentType) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }

  const data = await fileToBase64(file);

  const attachment: Attachment = {
    id: uuidv7(),
    type: attachmentType,
    name: file.name,
    size: file.size,
    mimeType: file.type,
    data,
  };

  // Create preview URL for images using shared helper
  if (attachmentType === 'image') {
    attachment.previewUrl = createPreviewUrl(data, file.type);
  }

  return attachment;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getSupportedModalities(modelFeatures: string[]): { supportsImages: boolean; supportsFiles: boolean } {
  return {
    supportsImages: modelFeatures.includes('image'),
    supportsFiles: modelFeatures.includes('file'),
  };
}

export function supportsImageGeneration(model: { architecture?: { outputModalities?: string[] } }): boolean {
  return model.architecture?.outputModalities?.includes('image') ?? false;
}
