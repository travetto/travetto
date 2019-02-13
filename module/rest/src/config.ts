import { Config } from '@travetto/config';
import { SSLUtil } from './util/ssl';
import { Env, AppError } from '../../base';

@Config('rest')
export class RestConfig {
  serve = true;
  port = 3000;
  disableGetCache = true;

  ssl?: boolean;
  keys?: {
    cert: string,
    key: string
  };

  async getKeys() {
    if (!this.keys) {
      if (Env.prod) {
        throw new AppError('Cannot use test keys in production', 'permissions');
      }
      return SSLUtil.generateKeyPair();
    } else {
      return this.keys;
    }
  }
}
