import { Config } from '@travetto/config';

@Config('model.sql')
export class ModelSqlConfig {
  host = '127.0.0.1';
  dialect = 'mysql';
  port = 3306;
  username = 'mysql';
  password = 'mysql';
  options = {};
  namespace = 'app';
}