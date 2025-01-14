import { SessionRawSymbol } from './service';
import { Session } from './session';

/**
 * Declare the session on the request
 */
declare module '@travetto/rest' {
  interface Request {
    readonly session: Session;
    [SessionRawSymbol]: Session;
  }
}