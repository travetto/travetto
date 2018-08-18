import { AuthServiceAdapter } from './service-adapter';

declare global {
  namespace Travetto {
    export interface Request {
      auth: AuthServiceAdapter;
    }
  }
}