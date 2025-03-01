import { Session } from '@travetto/auth-session';

/**
 * Declare the session on the request
 */
declare module '@travetto/web' {
  interface HttpRequest {
    readonly session?: Session;
  }
}