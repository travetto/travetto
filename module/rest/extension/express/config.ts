import { Config } from '@travetto/config';

@Config('express')
export class ExpressConfig {
  cookie = {
    secure: false
  };
  secret = 'secret';
}