import { Config } from '@travetto/config';

@Config('auth.crowd')
export class AuthCrowdConfig {
  usernameField: string;
  passwordField: string;
  baseUrl: string;
  application: string;
  password: string;
}