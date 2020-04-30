import { Env } from '@travetto/base';
import { Config } from '@travetto/config';
import { EsSchemaConfig } from './types';

@Config('elasticsearch.model')
// TODO: Document
export class ElasticsearchModelConfig {
  hosts = ['127.0.0.1'];
  port = 9200;
  options = {};
  namespace = 'app';
  autoCreate = !Env.prod;
  schemaConfig: EsSchemaConfig = {
    caseSensitive: false
  };

  /* eslint-disable @typescript-eslint/camelcase */
  indexCreate = {
    number_of_replicas: 0,
    number_of_shards: 1
  };
  /* eslint-enable @typescript-eslint/camelcase */

  postConstruct() {
    console.debug('Constructed', this);
    this.hosts = this.hosts
      .map(x => x.includes(':') ? x : `${x}:${this.port}`)
      .map(x => x.startsWith('http') ? x : `http://${x}`) as any;
  }
}