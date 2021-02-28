import { Asset } from '@travetto/asset';
import type '@travetto/rest';

declare global {
  interface TravettoRequest {
    files: Record<string, Asset>;
  }
}