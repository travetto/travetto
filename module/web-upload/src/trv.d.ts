import { FileMap } from './types.ts';

declare module '@travetto/web' {
  interface HttpRequestInternal {
    uploads?: FileMap
  }
}