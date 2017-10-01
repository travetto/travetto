import { Config } from '@travetto/config';

@Config('auth.model')
export class ModelStrategyConfig {
  usernameField: string;
  passwordField: string;
  hashField: string;
  saltField: string;
  resetTokenField: string;
  resetExpiresField: string;
  modelClass: string;
}