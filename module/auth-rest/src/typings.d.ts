import { AuthContext } from '@travetto/auth';

declare global {
  namespace Travetto {
    export interface Request {
      /**
       * The auth context
       */
      auth: AuthContext;
      /**
       * The login context
       */
      loginContext?: Record<string, any>;
      /**
       * Log the user out
       */
      logout(): Promise<void>;
      /**
       * Perform a login
       * @param providers  List of providers to authenticate against
       */
      login(providers: symbol[]): Promise<AuthContext | undefined>; // Undefined is for multi step logins
    }
  }
}