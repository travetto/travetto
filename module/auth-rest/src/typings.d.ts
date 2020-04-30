import { AuthContext } from '@travetto/auth';

declare global {
  namespace Travetto {
    export interface Request {
      auth: AuthContext;
      loginContext?: Record<string, any>;
      logout(): Promise<void>;
      login(providers: (symbol | string)[]): Promise<AuthContext | undefined>; // Undefined is for multi step logins
    }
  }
}