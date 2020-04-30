import { Env } from '@travetto/base';
import { Config } from '@travetto/config';

@Config('sql.model')
// TODO: Document
export class SQLModelConfig {
  host = '127.0.0.1';
  port = 0;
  user = '';
  password = '';
  namespace = '';
  database = 'app';
  autoCreate = !Env.prod;
  version = '';
  options = {};
}