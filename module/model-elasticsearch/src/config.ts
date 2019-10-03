import { Env } from '@travetto/base';
import { Config } from '@travetto/config';
import { EsSchemaConfig } from './types';
import { BasicAuth, ApiKeyAuth } from '@elastic/elasticsearch/lib/pool';

@Config('elasticsearch.model')
export class ElasticsearchModelConfig {
  hosts = ['127.0.0.1'];
  port = 9200;
  options = {};
  namespace = 'app';
  autoCreate = !Env.prod;
  schemaConfig: EsSchemaConfig = {
    caseSensitive: false
  };
  auth: BasicAuth | ApiKeyAuth;

  indexCreate = {
    number_of_replicas: 0,
    number_of_shards: 1
  };

  postConstruct() {
    console.debug('Constructed', this);
    this.hosts = this.hosts
      .map(x => x.includes(':') ? x : `${x}:${this.port}`)
      .map(x => x.startsWith('http') ? x : `http://${x}`) as any;
  }
}