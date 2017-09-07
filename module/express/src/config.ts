import { Config } from '@encore2/config';

@Config('express')
export class ExpressConfig {
  serve = true;
  port = 3000;
  session = {
    secret: 'random key',
    cookie: {
      secure: false,
      secureProxy: false
    }
  }
}
