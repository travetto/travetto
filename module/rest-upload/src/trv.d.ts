import { UploadMap } from './types';

declare global {
  interface TravettoRequest {
    uploads: UploadMap
  }

  /**
   * @concrete node:buffer#Blob
   */
  interface Blob { }

  /**
   * @concrete node:buffer#File
   */
  interface File { }
}