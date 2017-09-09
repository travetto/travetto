import { Config } from '@encore2/config';

@Config('auth.mongo')
export class MongoStrategyConfig {
  usernameField: string;
  passwordField: string;
  hashField: string;
  saltField: string;
  resetTokenField: string;
  resetExpiresField: string;
}