import { Principal } from '@travetto/auth';

/**
 * Declare the authenticated principal on the request
 */
declare module '@travetto/web' {
  interface HttpRequest {
    readonly user?: Principal;
  }
}