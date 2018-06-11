import { Config } from '@travetto/config';

@Config('auth.model')
export class AuthModelConfig {
  usernameField: string = 'username';
  passwordField: string = 'password';
  hashField: string = 'hash';
  saltField: string = 'salt';
  resetTokenField: string = 'resetToken';
  resetExpiresField: string = 'resetExpires';
  modelClass: string = '';
}