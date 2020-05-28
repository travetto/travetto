import { Config } from '@travetto/config';

/**
 * Rest session config
 */
@Config('rest.session')
export class SessionConfig {
  /**
   * Should the session auto write
   */
  autoCommit = true;
  /**
   * Max age for a given session
   */
  maxAge = 30 * 60 * 1000; // Half hour
  /**
   * Can the session be renewed
   */
  renew = true;
  /**
   * Should the session support rolling renewals
   */
  rolling = false;
  /**
   * Should the session be signed
   */
  sign = true;
  /**
   * Secret for signing the session
   */
  secret: string;
  /**
   * Signature key name
   */
  keyName = 'trv_sid';
}