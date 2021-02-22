import { Asset } from '@travetto/asset';
import '@travetto/rest';

declare global {
  interface TravettoRequest {
    files: Record<string, Asset>;
  }
}