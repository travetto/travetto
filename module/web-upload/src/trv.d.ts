import { FileMap } from './types.ts';

declare module '@travetto/web' {
  interface HttpRequestInternal<T = unknown> {
    uploads?: FileMap
  }
}