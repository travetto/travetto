import { Config } from '@travetto/config';

@Config('model.sql')
export class ModelElasticsearchConfig {
  host = '127.0.0.1';
  dialect = 'mysql';
  port = 3306;
  options = {};
  namespace = 'app';
}