import { Session } from './types';
import { TRV_SESSION } from './internal/types';

/**
 * Declare the session on the request
 */
declare global {
  namespace Travetto {
    interface Request {
      [TRV_SESSION]: Session;
      readonly session: Session;
    }
  }
}