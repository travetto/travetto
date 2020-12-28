import { Session } from './types';
import { SessionSym } from './internal/types';

/**
 * Declare the session on the request
 */
declare global {
  namespace Travetto {
    interface Request {
      [SessionSym]: Session;
      readonly session: Session;
    }
  }
}