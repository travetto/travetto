import { UploadMap } from './types';

declare module '@travetto/rest' {
  interface TravettoRequest {
    uploads: UploadMap
  }
}