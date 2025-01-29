import { Config } from '@travetto/config';

@Config('rest.auth')
export class RestAuthConfig {
  mode: 'cookie' | 'header' = 'cookie';
  header: string = 'Authorization';
  cookie: string = 'trv_auth';
  headerPrefix: string = 'Token';
}