import { Config } from '@travetto/config';
import { ModelMongoConfig } from '@travetto/model-mongo';

export const AUTH = Symbol('auth');

@Config('app')
export class AppConfig {
  baseUrl = 'http://localhost/rest';
}

@Config('auth.mongo')
export class AuthMongo extends ModelMongoConfig { }
