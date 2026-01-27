import type { BinaryBlob } from '@travetto/runtime';

/**
 * @concrete
 */
export interface UploadMap extends Record<string, BinaryBlob> { }