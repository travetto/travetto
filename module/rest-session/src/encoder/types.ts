import { Request, Response } from '@travetto/rest';
import { Session } from '../types';

/**
 * Basic encoder for reading/writing the session to/from a user request/response
 *
 * The session may be an entire payload or it may just be a session identifier.
 *
 * @concrete ../internal/types:SessionEncoderTarget
 */
export interface SessionEncoder {
  /**
   * Send the session to the user
   */
  encode(req: Request, res: Response, session: Session | null): Promise<void>;
  /**
   * Read the session from the user
   */
  decode(req: Request): Promise<string | Session | undefined>;
}