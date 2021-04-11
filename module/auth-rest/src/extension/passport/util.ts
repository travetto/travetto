// @file-if passport
import * as passport from 'passport';

import { Util } from '@travetto/base';
import { Request } from '@travetto/rest';


export interface PassportAuthOptions {
  state?: ((req: Request) => Record<string, unknown>) | Record<string, unknown>;
}

/**
 * Passport utilities
 */
export class PassportUtil {

  /**
   * Create login context
   * @param req The travetto request,
   * @param state The passport auth config state
   */
  static createLoginContext(req: Request, { state }: PassportAuthOptions): Partial<passport.AuthenticateOptions> {
    const stateRec = Util.isFunction(state) ? state.call(null, req) : (state ?? {});
    const json = JSON.stringify({ referrer: req.header('referrer'), ...stateRec });

    return {
      state: Buffer.from(json).toString('base64')
    };
  }

  /**
   * Process request read state from query
   * @param req The travetto request
   */
  static getLoginContext(req: Request) {
    if (req.query.state) {
      if (typeof req.query.state === 'string' && req.query.state) {
        try {
          return JSON.parse(Buffer.from(req.query.state, 'base64').toString('utf8'));
        } catch {
          console.error('Unable to process previous login state');
        }
      }
    }
  }
}