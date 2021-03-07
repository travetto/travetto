import { Request, Response } from '@travetto/rest';
import { Session } from '../types';

/**
 * Provider for managing a session. Allows reading/writing the session to/from a user request/response
 *
 * @concrete ../internal/types:SessionProviderTarget
 */
export interface SessionProvider {
  /**
   * Send the session to the user
   */
  encode(req: Request, res: Response, session: Session | null): Promise<void>;
  /**
   * Read the session from the user
   */
  decode(req: Request): Promise<Session | undefined>;
  /**
   * Deletes a session from the provider
   */
  delete?(req: Request, res: Response, id: string): Promise<void>;
}