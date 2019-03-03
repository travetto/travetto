import { AuthRequestAdapter } from './types';

declare global {
  namespace Travetto {
    export interface Request {
      auth: AuthRequestAdapter;
    }
  }
}