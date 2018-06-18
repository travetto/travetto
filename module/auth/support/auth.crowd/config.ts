import { Config } from '@travetto/config';

@Config('auth.crowd')
export class AuthCrowdConfig {
  baseUrl: string;
  application: string;
  password: string;
}
