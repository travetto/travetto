import { Asset } from '@travetto/asset';
import '@travetto/rest';

declare global {
  namespace Travetto {
    interface Request {
      files: Record<string, Asset>;
    }
  }
}