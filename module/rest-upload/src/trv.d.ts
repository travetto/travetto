import { UploadMap } from './types';

declare module '@travetto/rest' {
  interface Request {
    uploads: UploadMap
  }
}