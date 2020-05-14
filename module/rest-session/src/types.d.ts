import { Session } from './types';
import { TRV_SESSION } from './internal/types';

declare global {
  namespace Travetto {
    interface Request {
      [TRV_SESSION]: Session;
      readonly session: Session;
    }
  }
}