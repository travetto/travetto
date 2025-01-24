import { TimeUtil } from '@travetto/runtime';
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
  maxAge = TimeUtil.asMillis(30, 'm'); // Half hour
  /**
   * Can the session be renewed
   */
  renew = true;
  /**
   * Should the session support rolling renewals
   */
  rolling = false;

}