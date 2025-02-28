import { Session } from '@travetto/auth-session';

/**
 * Declare the session on the request
 */
declare module '@travetto/rest' {
  interface HttpRequest {
    readonly session?: Session;
  }
}