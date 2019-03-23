import { Config } from '@travetto/config';

@Config('rest.session.store')
export class SessionStoreConfig {
  autoCommit = true;
  maxAge = 30 * 60 * 1000;
  renew = true;
  rolling = false;
}