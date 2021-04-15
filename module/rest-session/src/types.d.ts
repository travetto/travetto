import { Session } from './session';

/**
 * Declare the session on the request
 */
declare global {
  interface TravettoRequest {
    readonly session: Session;
  }
}