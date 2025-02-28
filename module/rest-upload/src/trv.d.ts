import { UploadMap } from './types';

declare module '@travetto/rest' {
  interface HttpRequest {
    uploads: UploadMap
  }
}