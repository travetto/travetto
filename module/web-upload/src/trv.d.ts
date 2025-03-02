import { FileMap } from './types';

declare module '@travetto/web' {
  interface HttpRequest {
    uploads: FileMap
  }
}