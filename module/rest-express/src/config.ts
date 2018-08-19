import { Config } from '@travetto/config';

@Config('rest.express')
export class ExpressConfig {
  cookie = {
    secure: false
  };
  secret = 'secret';
}