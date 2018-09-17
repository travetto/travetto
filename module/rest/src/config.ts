import { Config } from '@travetto/config';

@Config('rest')
export class RestConfig {
  serve = true;
  port = 3000;
  disableGetCache = true;
}
