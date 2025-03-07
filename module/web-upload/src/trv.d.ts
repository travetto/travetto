import { FileMap, WebUploadSymbol } from './types';

declare module '@travetto/web' {
  interface HttpRequest {
    [WebUploadSymbol]: FileMap
  }
}