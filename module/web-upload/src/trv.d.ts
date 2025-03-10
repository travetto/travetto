import { FileMap } from './types';

declare module '@travetto/web' {
  interface HttpRequestInternal<T = unknown> {
    uploads?: FileMap
  }
}