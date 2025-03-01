import { UploadMap } from './types';

declare module '@travetto/web' {
  interface HttpRequest {
    uploads: UploadMap
  }
}