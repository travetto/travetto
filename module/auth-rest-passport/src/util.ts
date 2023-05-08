import passport from 'passport';

import { Request } from '@travetto/rest';

import { LoginContext } from '@travetto/auth-rest';

const readState = (state?: string): Record<string, unknown> | undefined => {
  try {
    if (state) {
      return JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    }
  } catch {
    return;
  }
};

/**
 * Passport utilities
 */
export class PassportUtil {

  /**
   * Enhance passport options with enhanced state information
   * @param req The travetto request,
   * @param opts The passport auth options
   */
  static enhanceLoginContext(req: Request, opts: Partial<passport.AuthenticateOptions> = {}): Partial<passport.AuthenticateOptions> {
    const state = readState(opts.state);
    const json = JSON.stringify({ referer: req.header('referer'), ...state });
    return {
      state: Buffer.from(json).toString('base64'),
    };
  }

  /**
   * Process request read state from query
   * @param req The travetto request
   */
  static getLoginContext(req: Request): LoginContext | undefined {
    if (req.query.state) {
      if (typeof req.query.state === 'string' && req.query.state) {
        try {
          return readState(req.query.state);
        } catch {
          console.error('Unable to process previous login state');
        }
      }
    }
  }
}