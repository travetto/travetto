import { UploadMap } from './types.ts';

declare module '@travetto/rest' {
  interface Request {
    uploads: UploadMap
  }
}