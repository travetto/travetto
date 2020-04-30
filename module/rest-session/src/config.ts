import { Config } from '@travetto/config';

@Config('rest.session')
// TODO: Document
export class SessionConfig {
  autoCommit = true;
  maxAge = 30 * 60 * 1000; // Half hour
  renew = true;
  rolling = false;

  sign = true;
  secret: string;
  keyName = 'trv_sid';
}