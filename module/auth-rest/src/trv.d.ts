import { Principal } from '@travetto/auth';

/**
 * Declare the authenticated principal on the request
 */
declare module '@travetto/rest' {
  interface Request {
    readonly user?: Principal;
  }
}