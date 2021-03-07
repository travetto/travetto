import { Request, Response } from '@travetto/rest';
import { SessionConfig } from '../config';
import { Session } from '../types';

/**
 * Utils for reading/writing cookie/header information from the request
 */
export class EncodeUtil {

  /**
   * Indicates if a request supports deletion
   */
  static canDelete(req: Request, config: SessionConfig) {
    return config.transport === 'cookie' && req.cookies.get(config.keyName);
  }

  /**
   * Get value
   */
  static getValue(req: Request, config: SessionConfig) {
    let payload: string;
    if (config.transport === 'cookie') {
      payload = req.cookies.get(config.keyName) as string;
    } else {
      payload = req.header(config.keyName) as string;
    }
    return payload;
  }

  /**
   * Store value back into request
   */
  static putValue(res: Response, config: SessionConfig, session: null): void;
  static putValue(res: Response, config: SessionConfig, session: Session, extract: (op: Session) => string): void;
  static putValue(res: Response, config: SessionConfig, session: Session | null, extract?: (op: Session) => string) {
    if (session) {
      if (config.transport === 'cookie') {
        res.cookies.set(config.keyName, extract!(session), {
          maxAge: !session.expiresAt ? -1 : undefined, // Session cookie by default
          expires: session.expiresAt
        });
      } else {
        res.setHeader(config.keyName, session.id);
      }
    } else {
      res.cookies.set(config.keyName, null, { maxAge: 0, });
    }
  }
}