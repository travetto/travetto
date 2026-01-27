import { UploadMap } from './types.ts';

declare module '@travetto/web' {
  interface WebRequestInternal {
    uploads?: UploadMap
  }
}