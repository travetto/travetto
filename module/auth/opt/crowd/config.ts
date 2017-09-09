import { Config } from '@encore2/config';

@Config('auth.crowd')
export class CrowdStrategyConfig {
  usernameField: string;
  passwordField: string;
  baseUrl: string;
  application: string;
  password: string;
}