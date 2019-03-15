import { AuthContext } from '@travetto/auth';

import { AuthRequestAdapter } from './types';

declare global {
  namespace Travetto {
    export interface Request {
      __authContext: AuthContext;
      auth: AuthRequestAdapter;
    }
  }
}