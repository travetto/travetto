import { Config } from '@travetto/config';

@Config('model.elasticsearch')
export class ModelElasticsearchConfig {
  hosts = 'localhost';
  cluster = 'app';
  port = 9200;
  options = {};

  postConstruct() {

  }
}