import { Session } from './session';
import { SessionSym } from './internal/types';

/**
 * Declare the session on the request
 */
declare global {
  interface TravettoRequest {
    [SessionSym]: Session;
    readonly session: Session;
  }
}