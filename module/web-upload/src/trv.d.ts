import { FileMap } from './types.ts';

declare module '@travetto/web' {
  interface WebRequestInternal {
    uploads?: FileMap
  }
}