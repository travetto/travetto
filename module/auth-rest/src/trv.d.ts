import { Principal } from '@travetto/auth';

import { LoginContextⲐ } from './internal/types';
import { LoginContext } from './types';

declare module '@travetto/rest' {
  export interface TravettoRequest {
    /**
     * The authenticated principal
     */
    auth?: Principal;
    /**
     * Any additional context for login
     */
    [LoginContextⲐ]?: LoginContext;
  }
}