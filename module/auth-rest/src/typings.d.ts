import { Identity, AuthContext } from '@travetto/auth';

declare global {
  namespace Travetto {
    export interface Request {
      auth: AuthContext;
      logout(): Promise<void>;
      login(providers: (symbol | string)[]): Promise<AuthContext | undefined>; // Undefined is for multi step logins
    }
  }
}