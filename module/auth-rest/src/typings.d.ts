import { AuthContext } from '@travetto/auth';

import { AuthRequestAdapter } from './adapter';

declare global {
  namespace Travetto {
    export interface Request {
      auth: AuthRequestAdapter;
      authenticate(providers: (symbol | string)[]): void;
    }
  }
}